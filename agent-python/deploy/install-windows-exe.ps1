#Requires -Version 5.1
<#
.SYNOPSIS
    Instalador do PAC CONTROL Agent para Windows (versao executavel).
    Nao requer Python instalado.

.PARAMETER ApiToken
    Token de autenticacao do agente (obtido no painel PAC CONTROL).

.PARAMETER UserId
    UUID do usuario cadastrado no sistema.

.PARAMETER AgentDir
    Diretorio de instalacao. Padrao: C:\PACControlAgent

.EXAMPLE
    .\install-windows-exe.ps1 -ApiToken "SEU_TOKEN" -UserId "UUID_DO_USUARIO"

.EXAMPLE
    # Desinstalar:
    .\install-windows-exe.ps1 -Uninstall
#>

param(
    [Parameter(Mandatory=$false)][string]$ApiToken  = "",
    [Parameter(Mandatory=$false)][string]$UserId    = "",
    [string]$ApiBaseUrl            = "https://controle.pactarefas.com.br",
    [string]$AgentDir              = "C:\PACControlAgent",
    [int]$ScreenshotIntervalSec    = 60,
    [int]$RecordingIntervalSec     = 120,
    [int]$RecordingDurationSec     = 20,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$TaskName = "PACControlAgent"
$ExeName  = "PACControlAgent.exe"

function Write-Log {
    param([string]$Msg, [string]$Level = "INFO")
    $line = "[$(Get-Date -Format 'HH:mm:ss')] [$Level] $Msg"
    Write-Host $line
    Add-Content -Path "$AgentDir\install.log" -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

# ─── DESINSTALACAO ─────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Host "Desinstalando PAC CONTROL Agent..." -ForegroundColor Yellow
    schtasks /End    /TN $TaskName 2>$null | Out-Null
    schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
    if (Test-Path $AgentDir) {
        Remove-Item -Recurse -Force $AgentDir
        Write-Host "Removido: $AgentDir" -ForegroundColor Green
    }
    Write-Host "Desinstalacao concluida." -ForegroundColor Green
    exit 0
}

# ─── COLETA PARAMETROS SE AUSENTES ─────────────────────────────────────────
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   PAC CONTROL Agent — Instalacao        " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $ApiToken) {
    $ApiToken = Read-Host "Cole aqui o TOKEN do colaborador"
}
if (-not $UserId) {
    $UserId = Read-Host "Cole aqui o USER ID do colaborador"
}

if (-not $ApiToken -or -not $UserId) {
    Write-Host "ERRO: Token e User ID sao obrigatorios." -ForegroundColor Red
    exit 1
}

# ─── VERIFICA QUE O .EXE ESTA AQUI ────────────────────────────────────────
$ExeSrc = Join-Path $PSScriptRoot $ExeName
if (-not (Test-Path $ExeSrc)) {
    Write-Host "ERRO: $ExeName nao encontrado na mesma pasta do instalador." -ForegroundColor Red
    Write-Host "Certifique-se de que $ExeName e install-windows-exe.ps1 estao na mesma pasta." -ForegroundColor Yellow
    exit 1
}

# ─── CRIA DIRETORIO ────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
Write-Log "Diretorio criado: $AgentDir"

# ─── COPIA O EXECUTAVEL ────────────────────────────────────────────────────
Copy-Item -Force $ExeSrc "$AgentDir\$ExeName"
Write-Log "Executavel copiado: $AgentDir\$ExeName"

# ─── CRIA config.json ─────────────────────────────────────────────────────
$config = [ordered]@{
    api_base_url                = $ApiBaseUrl.TrimEnd("/")
    api_token                   = $ApiToken
    user_id                     = $UserId
    agent_version               = "0.1.0"
    sample_interval_sec         = 10
    heartbeat_interval_sec      = 30
    flush_interval_sec          = 20
    batch_size                  = 50
    idle_threshold_sec          = 300
    verify_tls                  = $true
    request_timeout_sec         = 10
    enable_screenshots          = $true
    screenshot_interval_sec     = $ScreenshotIntervalSec
    screenshot_max_width        = 1600
    screenshot_quality          = 55
    screenshot_only_when_active = $true
    enable_recordings           = $true
    recording_interval_sec      = $RecordingIntervalSec
    recording_duration_sec      = $RecordingDurationSec
    recording_fps               = 3
    recording_max_width         = 960
}
$config | ConvertTo-Json -Depth 3 | Set-Content "$AgentDir\config.json" -Encoding UTF8
Write-Log "config.json criado."

# ─── REGISTRA TAREFA NO TASK SCHEDULER ────────────────────────────────────
schtasks /End    /TN $TaskName 2>$null | Out-Null
schtasks /Delete /TN $TaskName /F 2>$null | Out-Null

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>PAC CONTROL desktop agent</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$currentUser</UserId>
      <Delay>PT20S</Delay>
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
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Hidden>true</Hidden>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <RestartOnFailure>
      <Count>999</Count>
      <Interval>PT1M</Interval>
    </RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"$AgentDir\$ExeName"</Command>
      <WorkingDirectory>$AgentDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$xmlPath = "$env:TEMP\paccontrol-task.xml"
[System.IO.File]::WriteAllText($xmlPath, $taskXml, [System.Text.Encoding]::Unicode)
schtasks /Create /TN $TaskName /XML $xmlPath /F | Out-Null
Remove-Item $xmlPath -ErrorAction SilentlyContinue
Write-Log "Tarefa registrada no Task Scheduler."

# ─── INICIA AGORA ─────────────────────────────────────────────────────────
Write-Log "Iniciando agente..."
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 4

# ─── VERIFICA ─────────────────────────────────────────────────────────────
$running = (Get-Process -Name "PACControlAgent" -ErrorAction SilentlyContinue) -ne $null
Write-Host ""
if ($running) {
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "   INSTALACAO CONCLUIDA - Agente rodando " -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
} else {
    Write-Host "Agente instalado. Sera iniciado automaticamente no proximo login." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Pasta   : $AgentDir" -ForegroundColor White
Write-Host "  Config  : $AgentDir\config.json" -ForegroundColor White
Write-Host ""
Write-Host "Comandos uteis:" -ForegroundColor Gray
Write-Host "  Ver status  : schtasks /Query /TN PACControlAgent" -ForegroundColor Gray
Write-Host "  Parar       : schtasks /End /TN PACControlAgent" -ForegroundColor Gray
Write-Host "  Desinstalar : powershell -File install-windows-exe.ps1 -Uninstall" -ForegroundColor Gray
Write-Host ""
