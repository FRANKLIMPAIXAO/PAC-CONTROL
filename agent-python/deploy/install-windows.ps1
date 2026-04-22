#Requires -Version 5.1
<#
.SYNOPSIS
    Instalador do PAC CONTROL Agent para Windows.

.DESCRIPTION
    Copia o agente para C:\PACControlAgent, instala dependencias Python,
    cria config.json e registra tarefa no Task Scheduler para iniciar
    automaticamente no logon do usuario, rodando oculto (sem janela).

.PARAMETER ApiBaseUrl
    URL base da API. Ex: https://controle.pactarefas.com.br

.PARAMETER ApiToken
    Token de autenticacao do agente.

.PARAMETER UserId
    UUID do usuario associado a este dispositivo.

.PARAMETER AgentDir
    Diretorio de instalacao. Padrao: C:\PACControlAgent

.PARAMETER ScreenshotIntervalSec
    Intervalo entre capturas de tela em segundos. Padrao: 60

.EXAMPLE
    .\install-windows.ps1 -ApiBaseUrl "https://controle.pactarefas.com.br" -ApiToken "SEU_TOKEN" -UserId "uuid-do-usuario"

.EXAMPLE
    # Execucao silenciosa para deploy em massa via GPO ou RMM:
    powershell -ExecutionPolicy Bypass -File install-windows.ps1 -ApiBaseUrl "https://..." -ApiToken "..." -UserId "..."
#>

param(
    [Parameter(Mandatory=$false)][string]$ApiBaseUrl  = "",
    [Parameter(Mandatory=$false)][string]$ApiToken    = "",
    [Parameter(Mandatory=$false)][string]$UserId      = "",
    [string]$AgentDir             = "C:\PACControlAgent",
    [string]$AgentVersion         = "0.1.0",
    [int]$SampleIntervalSec       = 10,
    [int]$HeartbeatIntervalSec    = 30,
    [int]$FlushIntervalSec        = 20,
    [int]$BatchSize               = 50,
    [int]$IdleThresholdSec        = 300,
    [int]$ScreenshotIntervalSec   = 60,
    [int]$ScreenshotMaxWidth      = 1600,
    [int]$ScreenshotQuality       = 55,
    [int]$RecordingIntervalSec    = 120,
    [int]$RecordingDurationSec    = 20,
    [int]$RecordingFps            = 3,
    [int]$RecordingMaxWidth       = 960,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$TaskName = "PACControlAgent"
$LogFile  = "$AgentDir\install.log"

function Write-Log {
    param([string]$Msg, [string]$Level = "INFO")
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Msg"
    Write-Host $line
    if (Test-Path (Split-Path $LogFile)) {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    }
}

# ─── DESINSTALACAO ────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Log "Desinstalando PAC CONTROL Agent..."
    schtasks /End /TN $TaskName 2>$null | Out-Null
    schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
    if (Test-Path $AgentDir) {
        Remove-Item -Recurse -Force $AgentDir
        Write-Log "Diretorio removido: $AgentDir"
    }
    Write-Log "Desinstalacao concluida."
    exit 0
}

# ─── COLETA PARAMETROS INTERATIVAMENTE SE AUSENTES ───────────────────────────
if (-not $ApiBaseUrl) {
    $ApiBaseUrl = Read-Host "URL da API (ex: https://controle.pactarefas.com.br)"
}
if (-not $ApiToken) {
    $ApiToken = Read-Host "Token do agente"
}
if (-not $UserId) {
    $UserId = Read-Host "User ID (UUID do usuario)"
}

if (-not $ApiBaseUrl -or -not $ApiToken -or -not $UserId) {
    Write-Log "ApiBaseUrl, ApiToken e UserId sao obrigatorios." "ERROR"
    exit 1
}

Write-Log "=== Iniciando instalacao do PAC CONTROL Agent ==="
Write-Log "Diretorio: $AgentDir"
Write-Log "Usuario: $UserId"

# ─── DETECTA PYTHON ──────────────────────────────────────────────────────────
function Find-Python {
    $candidates = @(
        "pythonw.exe",                      # no PATH (sem janela)
        "python.exe",                       # no PATH
        "$env:LOCALAPPDATA\Programs\Python\Python313\pythonw.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\pythonw.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\pythonw.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\pythonw.exe",
        "C:\Python313\pythonw.exe",
        "C:\Python312\pythonw.exe",
        "C:\Python311\pythonw.exe",
        "C:\Python310\pythonw.exe",
        "C:\Program Files\Python313\pythonw.exe",
        "C:\Program Files\Python312\pythonw.exe"
    )
    foreach ($c in $candidates) {
        try {
            $resolved = (Get-Command $c -ErrorAction SilentlyContinue)?.Source
            if (-not $resolved) { $resolved = $c }
            if (Test-Path $resolved) {
                # Verifica versao minima 3.9
                $ver = & ($resolved -replace "pythonw","python") --version 2>&1
                if ($ver -match "Python 3\.(\d+)" -and [int]$Matches[1] -ge 9) {
                    return $resolved
                }
            }
        } catch {}
    }
    # Tenta py launcher
    try {
        $pyPath = & py -3 -c "import sys; print(sys.executable)" 2>$null
        if ($pyPath -and (Test-Path $pyPath)) {
            $wpyPath = $pyPath -replace "python\.exe$","pythonw.exe"
            if (Test-Path $wpyPath) { return $wpyPath }
            return $pyPath
        }
    } catch {}
    return $null
}

Write-Log "Procurando Python 3.9+..."
$PythonW = Find-Python
if (-not $PythonW) {
    Write-Log "Python 3.9+ nao encontrado. Instale em https://python.org e execute novamente." "ERROR"
    Write-Log "Dica: marque 'Add Python to PATH' durante a instalacao."
    exit 1
}
$PythonExe = $PythonW -replace "pythonw\.exe$","python.exe"
Write-Log "Python encontrado: $PythonW"

# ─── CRIA DIRETORIO ───────────────────────────────────────────────────────────
Write-Log "Criando diretorio $AgentDir..."
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null

# ─── COPIA main.py ────────────────────────────────────────────────────────────
$MainPySrc = Join-Path $PSScriptRoot "..\main.py"
if (-not (Test-Path $MainPySrc)) {
    $MainPySrc = Join-Path $PSScriptRoot "main.py"
}
if (-not (Test-Path $MainPySrc)) {
    Write-Log "main.py nao encontrado em: $MainPySrc" "ERROR"
    Write-Log "Coloque main.py na mesma pasta do instalador ou na pasta pai."
    exit 1
}
Copy-Item -Force $MainPySrc "$AgentDir\main.py"
Write-Log "main.py copiado para $AgentDir\main.py"

# ─── INSTALA DEPENDENCIAS ─────────────────────────────────────────────────────
Write-Log "Instalando dependencias Python..."
$deps = @("requests>=2.32", "psutil>=6.1", "pynput>=1.7", "mss>=9.0", "Pillow>=10.4", "imageio[ffmpeg]>=2.34", "numpy>=1.26")
foreach ($dep in $deps) {
    Write-Log "  pip install $dep"
    & $PythonExe -m pip install --quiet --upgrade $dep
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Aviso: falha ao instalar $dep (pode ja estar instalado ou sem internet)." "WARN"
    }
}
Write-Log "Dependencias instaladas."

# ─── CRIA config.json ─────────────────────────────────────────────────────────
Write-Log "Criando config.json..."
$config = [ordered]@{
    api_base_url                = $ApiBaseUrl.TrimEnd("/")
    api_token                   = $ApiToken
    user_id                     = $UserId
    agent_version               = $AgentVersion
    sample_interval_sec         = $SampleIntervalSec
    heartbeat_interval_sec      = $HeartbeatIntervalSec
    flush_interval_sec          = $FlushIntervalSec
    batch_size                  = $BatchSize
    idle_threshold_sec          = $IdleThresholdSec
    verify_tls                  = $true
    request_timeout_sec         = 10
    enable_screenshots          = $true
    screenshot_interval_sec     = $ScreenshotIntervalSec
    screenshot_max_width        = $ScreenshotMaxWidth
    screenshot_quality          = $ScreenshotQuality
    screenshot_only_when_active = $true
    enable_recordings           = $true
    recording_interval_sec      = $RecordingIntervalSec
    recording_duration_sec      = $RecordingDurationSec
    recording_fps               = $RecordingFps
    recording_max_width         = $RecordingMaxWidth
}
$configJson = $config | ConvertTo-Json -Depth 3
Set-Content -Path "$AgentDir\config.json" -Value $configJson -Encoding UTF8
Write-Log "config.json criado."

# ─── CRIA WRAPPER VBS (roda pythonw sem flash de janela) ─────────────────────
# pythonw.exe ja roda sem console. O wrapper garante variaveis de ambiente.
$wrapperVbs = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Environment("Process")("PAC_AGENT_CONFIG") = "$AgentDir\config.json"
WshShell.Environment("Process")("PYTHONUNBUFFERED") = "1"
WshShell.Run """$PythonW"" ""$AgentDir\main.py""", 0, False
"@
Set-Content -Path "$AgentDir\start-agent.vbs" -Value $wrapperVbs -Encoding UTF8
Write-Log "Wrapper VBS criado: $AgentDir\start-agent.vbs"

# ─── REGISTRA TAREFA NO TASK SCHEDULER ───────────────────────────────────────
Write-Log "Registrando tarefa no Task Scheduler: $TaskName"

# Remove tarefa anterior se existir
schtasks /End /TN $TaskName 2>$null | Out-Null
schtasks /Delete /TN $TaskName /F 2>$null | Out-Null

# XML da tarefa — logon do usuario atual, oculta, restart automatico
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>PAC CONTROL desktop agent - monitoramento de atividade</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$currentUser</UserId>
      <Delay>PT30S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$currentUser</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Count>999</Count>
      <Interval>PT1M</Interval>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>"$AgentDir\start-agent.vbs"</Arguments>
      <WorkingDirectory>$AgentDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$xmlPath = "$env:TEMP\paccontrol-task.xml"
[System.IO.File]::WriteAllText($xmlPath, $taskXml, [System.Text.Encoding]::Unicode)

schtasks /Create /TN $TaskName /XML $xmlPath /F
if ($LASTEXITCODE -ne 0) {
    Write-Log "Falha ao registrar tarefa via XML. Tentando metodo alternativo..." "WARN"
    $action   = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$AgentDir\start-agent.vbs`"" -WorkingDirectory $AgentDir
    $trigger  = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -StartWhenAvailable `
        -Hidden
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -Description "PAC CONTROL desktop agent" -Force | Out-Null
}
Remove-Item $xmlPath -ErrorAction SilentlyContinue

Write-Log "Tarefa registrada com sucesso."

# ─── INICIA AGENTE AGORA ──────────────────────────────────────────────────────
Write-Log "Iniciando agente agora..."
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 3

$taskInfo = schtasks /Query /TN $TaskName /FO LIST 2>$null
if ($taskInfo -match "Status:\s+Running|Em execucao") {
    Write-Log "Agente iniciado e rodando."
} else {
    Write-Log "Agente registrado. Sera iniciado no proximo logon (ou rode: schtasks /Run /TN PACControlAgent)." "WARN"
}

Write-Log ""
Write-Log "=== Instalacao concluida ==="
Write-Log "  Diretorio : $AgentDir"
Write-Log "  Config    : $AgentDir\config.json"
Write-Log "  Log agente: $AgentDir\agent.log  (se habilitado)"
Write-Log "  Tarefa    : $TaskName"
Write-Log ""
Write-Log "Comandos uteis:"
Write-Log "  Verificar status : schtasks /Query /TN PACControlAgent"
Write-Log "  Iniciar          : schtasks /Run /TN PACControlAgent"
Write-Log "  Parar            : schtasks /End /TN PACControlAgent"
Write-Log "  Desinstalar      : powershell -File install-windows.ps1 -Uninstall"
