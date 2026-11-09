$ErrorActionPreference = 'Stop'
try {
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DragonNative {
 [StructLayout(LayoutKind.Sequential)] public struct POWER { public uint Version, ControlMask, StateMask; }
 [StructLayout(LayoutKind.Sequential)] public struct MEMORY { public uint Priority; }
 [StructLayout(LayoutKind.Sequential)] public struct LASTINPUT { public uint Size, Time; }
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool SetProcessInformation(IntPtr h,int kind,ref POWER value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool SetProcessInformation(IntPtr h,int kind,ref MEMORY value,uint size);
 [DllImport("psapi.dll",SetLastError=true)] public static extern bool EmptyWorkingSet(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUT input);
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW",SetLastError=true)] public static extern IntPtr SetWindowLongPtr(IntPtr h,int index,IntPtr value);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int cx,int cy,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION data; }
 [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public KEY key; [FieldOffset(0)] public MOUSE mouse; }
 [StructLayout(LayoutKind.Sequential)] public struct KEY { public ushort vk,scan; public uint flags,time; public UIntPtr extra; }
 [StructLayout(LayoutKind.Sequential)] public struct MOUSE { public int x,y; public uint data,flags,time; public UIntPtr extra; }
 [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint count,INPUT[] inputs,int size);
 public static bool Tap() {
  var down=new INPUT[1]; down[0].type=1; down[0].data.key.vk=0x20;
  var up=new INPUT[1]; up[0].type=1; up[0].data.key.vk=0x20; up[0].data.key.flags=2;
  if(SendInput(1,down,Marshal.SizeOf(typeof(INPUT)))!=1)return false;
  bool released=false;
  try { System.Threading.Thread.Sleep(80); }
  finally { released=SendInput(1,up,Marshal.SizeOf(typeof(INPUT)))==1; if(!released)released=SendInput(1,up,Marshal.SizeOf(typeof(INPUT)))==1; }
  return released;
 }
}
"@
function Describe($p) {
 try { [pscustomobject]@{pid=$p.Id;start=$p.StartTime.ToUniversalTime().ToString('o');path=$p.Path;cpuSeconds=$p.TotalProcessorTime.TotalSeconds;memoryBytes=$p.WorkingSet64;responding=$p.Responding;window=$p.MainWindowHandle.ToInt64();priority=$p.PriorityClass.ToString();affinity=$p.ProcessorAffinity.ToInt64().ToString();maxWorkingSet=$p.MaxWorkingSet.ToInt64().ToString();windowStyle=[DragonNative]::GetWindowLongPtr($p.MainWindowHandle,-16).ToInt64().ToString()} } catch { }
}
if ($request.action -eq 'probe') {
 $items=@(Get-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object { Describe $_ })
 $handler=$null
 try{$command=(Get-Item 'Registry::HKEY_CLASSES_ROOT\roblox-player\shell\open\command').GetValue('');if($command -match '^"([^"]+)"'){$handler=$Matches[1]}}catch{}
 $memory=Get-CimInstance Win32_OperatingSystem
 @{ok=$true;protocolHandlerPath=$handler;processes=$items;totalMemoryBytes=[double]$memory.TotalVisibleMemorySize*1024;freeMemoryBytes=[double]$memory.FreePhysicalMemory*1024;logicalCores=[Environment]::ProcessorCount}|ConvertTo-Json -Depth 5 -Compress
 exit
}
if ($request.action -eq 'diagnostics') {
 $quota=Get-ItemPropertyValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows' -Name GDIProcessHandleQuota -ErrorAction SilentlyContinue
 $computer=Get-CimInstance Win32_ComputerSystem
 $page=@(Get-CimInstance Win32_PageFileUsage | Select-Object AllocatedBaseSize,CurrentUsage,PeakUsage)
 @{ok=$true;gdiQuota=$quota;automaticPageFile=$computer.AutomaticManagedPagefile;pageFiles=$page}|ConvertTo-Json -Depth 5 -Compress
 exit
}
if ($request.action -notin @('policy','trim','stop','focus','minimize','antiAfk')) { throw 'Unsupported process action.' }
$p=Get-Process -Id ([int]$request.pid) -ErrorAction Stop
if ($p.ProcessName -ne 'RobloxPlayerBeta' -or $p.StartTime.ToUniversalTime().ToString('o') -ne [string]$request.start -or $p.Path -ne [string]$request.path) { throw 'Process identity changed; action refused.' }
switch ($request.action) {
 'policy' {
  $policy=$request.policy
  $p.PriorityClass=if($policy.lowPriority){'BelowNormal'}else{'Normal'}
  $power=New-Object DragonNative+POWER; $power.Version=1; $power.ControlMask=1; $power.StateMask=if($policy.ecoCpu){1}else{0}
  if(-not [DragonNative]::SetProcessInformation($p.Handle,4,[ref]$power,12)){throw 'Windows refused CPU efficiency policy.'}
  $memory=New-Object DragonNative+MEMORY; $memory.Priority=if($policy.memoryPriority){2}else{5}
  if(-not [DragonNative]::SetProcessInformation($p.Handle,0,[ref]$memory,4)){throw 'Windows refused memory priority.'}
  # Soft working-set target; Windows may exceed it. It is never a commit limit.
  if([int]$policy.workingSetMb -gt 0){$p.MaxWorkingSet=[IntPtr]([long]$policy.workingSetMb*1MB)}elseif($request.originalMaxWorkingSet){$p.MaxWorkingSet=[IntPtr]([long]$request.originalMaxWorkingSet)}
  if($policy.isolateCpu){$cores=[Math]::Min(62,[Environment]::ProcessorCount);$core=[int]$request.coreIndex % $cores;$p.ProcessorAffinity=[IntPtr]([long]1 -shl $core)}elseif($request.originalAffinity){$p.ProcessorAffinity=[IntPtr]([long]$request.originalAffinity)}
  if($p.MainWindowHandle -ne [IntPtr]::Zero -and $request.originalStyle){$style=[long]$request.originalStyle;if(-not $request.nativeWindows){$style=$style -band (-bnot 0x00C40000L)};[DragonNative]::SetWindowLongPtr($p.MainWindowHandle,-16,[IntPtr]$style)|Out-Null;[DragonNative]::SetWindowPos($p.MainWindowHandle,[IntPtr]::Zero,0,0,0,0,0x37)|Out-Null}
 }
 'trim' { if(-not [DragonNative]::EmptyWorkingSet($p.Handle)){throw 'Windows refused working-set trimming.'} }
 'stop' { $p.Kill() }
 'focus' { [DragonNative]::ShowWindow($p.MainWindowHandle,9)|Out-Null;if(-not [DragonNative]::SetForegroundWindow($p.MainWindowHandle)){throw 'Windows did not grant foreground focus.'} }
 'minimize' { [DragonNative]::ShowWindow($p.MainWindowHandle,6)|Out-Null }
 'antiAfk' {
  $controller=Get-Process -Id ([int]$request.controllerPid) -ErrorAction Stop
  if($controller.HasExited){throw 'DragonStrap is no longer running.'}
  $last=New-Object DragonNative+LASTINPUT; $last.Size=8
  if(-not [DragonNative]::GetLastInputInfo([ref]$last)){throw 'Windows idle time could not be read.'}
  $idle=([long][Environment]::TickCount - [long]$last.Time) -band 0xffffffffL
  [uint32]$front=0;[DragonNative]::GetWindowThreadProcessId([DragonNative]::GetForegroundWindow(),[ref]$front)|Out-Null
  if($front -ne $p.Id -or $idle -lt 60000){@{ok=$true;skipped=$true;sent=0;message='Waiting for an idle, foreground managed Roblox window.'}|ConvertTo-Json -Compress;exit}
  for($key=1;$key -le 255;$key++){if(([DragonNative]::GetAsyncKeyState($key) -band 0x8000) -ne 0){@{ok=$true;skipped=$true;sent=0;message='A key or mouse button is held; input skipped.'}|ConvertTo-Json -Compress;exit}}
  # Recheck focus immediately before input. Never bring a window to the foreground.
  [uint32]$front=0;[DragonNative]::GetWindowThreadProcessId([DragonNative]::GetForegroundWindow(),[ref]$front)|Out-Null
  if($front -ne $p.Id -or $controller.HasExited){@{ok=$true;skipped=$true;sent=0;message='Window focus changed; input skipped.'}|ConvertTo-Json -Compress;exit}
  if(-not [DragonNative]::Tap()){throw 'Windows refused the input event or key release.'}
  if(-not [DragonNative]::GetLastInputInfo([ref]$last)){@{ok=$true;sent=1;message='One Anti-AFK tap sent; second tap skipped because idle time was unavailable.'}|ConvertTo-Json -Compress;exit}
  $afterFirst=$last.Time
  Start-Sleep -Milliseconds ([Math]::Max(250,[Math]::Min(10000,[int]$request.delayMs)))
  $p.Refresh()
  if($controller.HasExited -or $p.HasExited){@{ok=$true;sent=1;message='One Anti-AFK tap sent; session or manager closed before the second tap.'}|ConvertTo-Json -Compress;exit}
  [uint32]$front=0;[DragonNative]::GetWindowThreadProcessId([DragonNative]::GetForegroundWindow(),[ref]$front)|Out-Null
  $canRead=[DragonNative]::GetLastInputInfo([ref]$last)
  $held=$false;for($key=1;$key -le 255;$key++){if(([DragonNative]::GetAsyncKeyState($key) -band 0x8000) -ne 0){$held=$true;break}}
  if($front -ne $p.Id -or -not $canRead -or $last.Time -ne $afterFirst -or $held){@{ok=$true;sent=1;message='One Anti-AFK tap sent; activity or focus changed, so the second tap was skipped.'}|ConvertTo-Json -Compress;exit}
  if(-not [DragonNative]::Tap()){throw 'Windows refused the second input event or key release.'}
  @{ok=$true;sent=2;message='Anti-AFK cycle sent to the idle, foreground Roblox window.'}|ConvertTo-Json -Compress;exit
 }
}
@{ok=$true}|ConvertTo-Json -Compress
} catch { @{ok=$false;message=$_.Exception.Message}|ConvertTo-Json -Compress;exit 1 }
