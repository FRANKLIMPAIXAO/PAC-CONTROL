param(
  [string]$AgentPath = "C:\\PACControlAgent",
  [string]$PythonExe = "C:\\Python313\\python.exe"
)

$taskName = "PAC CONTROL Agent"
$script = Join-Path $AgentPath "main.py"

$action = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "PAC CONTROL desktop agent" -Force
Write-Host "Task '$taskName' registrada com sucesso."
