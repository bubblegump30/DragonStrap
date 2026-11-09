param([ValidateSet('compile','idle','background','held','active','switch','human','idleFailure')][string]$Case='compile')
$ErrorActionPreference='Stop'
$source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\src\native\session-control.ps1')).Replace("`r`n","`n")
$tokens=$null;$errors=$null
[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)|Out-Null
if($errors.Count){throw ($errors.Message -join '; ')}
if($Case -eq 'compile'){
 $match=[regex]::Match($source,'(?s)Add-Type -TypeDefinition @"\n(.*?)\n"@')
 if(-not $match.Success){throw 'Native C# declaration not found.'}
 Add-Type -TypeDefinition $match.Groups[1].Value
 $size=[Runtime.InteropServices.Marshal]::SizeOf([type][DragonNative+INPUT])
 $expected=if([IntPtr]::Size -eq 8){40}else{28}
 if($size -ne $expected){throw "Invalid Windows INPUT layout: $size"}
 @{ok=$true;inputSize=$size;inputSent=$false}|ConvertTo-Json -Compress
 exit
}
# Exercise the shipped branch with a fake Windows input provider. Never call SendInput.
Add-Type -TypeDefinition @'
using System;
public class FakeAfk {
 public struct LASTINPUT { public uint Size, Time; }
 public static string Case;
 public static int Reads, FocusReads, Sent;
 public static bool GetLastInputInfo(ref LASTINPUT value) {
  Reads++;
  if(Case=="idleFailure")return false;
  value.Time=Reads==1?unchecked((uint)(Environment.TickCount-(Case=="active"?1000:61000))):(uint)(Case=="human"&&Reads>=3?43:42);
  return true;
 }
 public static IntPtr GetForegroundWindow(){return IntPtr.Zero;}
 public static uint GetWindowThreadProcessId(IntPtr window,out uint pid){FocusReads++;pid=(uint)(Case=="background"||(Case=="switch"&&FocusReads>=3)?456:123);return 1;}
 public static short GetAsyncKeyState(int key){return Case=="held"&&key==32?unchecked((short)0x8000):(short)0;}
 public static bool Tap(){Sent++;return true;}
}
'@
[FakeAfk]::Case=$Case
$request=[pscustomobject]@{action='antiAfk';controllerPid=$PID;delayMs=250}
$p=[pscustomobject]@{Id=123;HasExited=$false}
$p|Add-Member ScriptMethod Refresh {}
$start=$source.IndexOf(" 'antiAfk' {")
$end=$source.IndexOf("`n}`n@{ok=`$true}",$start)
if($start -lt 0 -or $end -lt 0){throw 'Anti-AFK branch not found.'}
$branch=$source.Substring($start,$end-$start).Replace('[DragonNative]','[FakeAfk]').Replace('New-Object DragonNative+LASTINPUT','New-Object FakeAfk+LASTINPUT')
if($branch.Contains('DragonNative') -or $branch.Contains('SendInput')){throw 'Refusing to run real input in the verification harness.'}
try{& ([scriptblock]::Create("switch ('antiAfk') {`n"+$branch+"`n}"))}catch{@{ok=$false;message=$_.Exception.Message}|ConvertTo-Json -Compress;exit}
