param([string]$library)
$ErrorActionPreference='Stop'
$computer=$null
try {
 $admin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
 $driver=Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO'
 if(-not $driver){@{cpu=@();status='driver-required'}|ConvertTo-Json -Compress;exit}
 if(-not $admin){@{cpu=@();status='administrator-required'}|ConvertTo-Json -Compress;exit}
 [Reflection.Assembly]::LoadFrom($library)|Out-Null
 $computer=New-Object LibreHardwareMonitor.Hardware.Computer
 $computer.IsCpuEnabled=$true
 $computer.Open()
 function ReadCpu($hardware){
  $hardware.Update()
  foreach($sensor in $hardware.Sensors){
   if($sensor.SensorType.ToString() -eq 'Temperature' -and $null -ne $sensor.Value -and [double]$sensor.Value -gt 0 -and [double]$sensor.Value -le 150){[pscustomobject]@{name=$sensor.Name;celsius=[Math]::Round([double]$sensor.Value,1)}}
  }
  foreach($child in $hardware.SubHardware){ReadCpu $child}
 }
 $readings=@(foreach($hardware in $computer.Hardware){ReadCpu $hardware})
 Start-Sleep -Milliseconds 200
 $readings=@(foreach($hardware in $computer.Hardware){ReadCpu $hardware})
 @{cpu=$readings;status=if($readings.Count){'live'}else{'no-sensor'}}|ConvertTo-Json -Compress -Depth 4
} catch {@{cpu=@();status='provider-error'}|ConvertTo-Json -Compress} finally {if($computer){$computer.Close()}}
