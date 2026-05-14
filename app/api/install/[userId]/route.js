import { sql } from '@/lib/db';

const EXE_URL =
  'https://github.com/FRANKLIMPAIXAO/PAC-CONTROL/releases/latest/download/PACControlAgent.exe';

export async function GET(req, { params }) {
  const { userId } = params;

  const rows = await sql`
    SELECT id, name FROM users
    WHERE id = ${userId} AND status = 'active'
    LIMIT 1
  `;
  if (rows.length === 0) {
    return new Response('Usuario nao encontrado ou inativo.', { status: 404 });
  }

  const token = process.env.AGENT_BOOTSTRAP_TOKEN || '';
  if (!token) {
    return new Response('AGENT_BOOTSTRAP_TOKEN nao configurado no servidor.', { status: 500 });
  }

  const host = req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const apiBaseUrl = `${proto}://${host}`;

  const script = generateScript({ userId, token, apiBaseUrl });

  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="instalar-agente.ps1"`,
    },
  });
}

function generateScript({ userId, token, apiBaseUrl }) {
  return `#Requires -Version 5.1
# PAC CONTROL Agent - Instalador automatico
# Gerado em: ${new Date().toISOString()}

$ErrorActionPreference = "Stop"
$AgentDir   = "C:\PACControlAgent"
$ExeName    = "PACControlAgent.exe"
$TaskName   = "PACControlAgent"
$ExeUrl     = "${EXE_URL}"
$ApiToken   = "${token}"
$UserId     = "${userId}"
$ApiBaseUrl = "${apiBaseUrl}"

function Write-Step { param([string]$M) Write-Host "  >> $M" -ForegroundColor Cyan }
function Write-OK   { param([string]$M) Write-Host "  OK $M" -ForegroundColor Green }
function Write-Fail { param([string]$M) Write-Host "  ERRO: $M" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "   PAC CONTROL Agent - Instalacao      " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

Write-Step "Parando agente anterior (se houver)..."
schtasks /End    /TN $TaskName 2>$null | Out-Null
schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
Get-Process -Name "PACControlAgent" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Step "Criando diretorio..."
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null

Write-Step "Baixando $ExeName..."
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $ExeUrl -OutFile "$AgentDir\$ExeName" -UseBasicParsing
  Write-OK "Download concluido."
} catch {
  Write-Fail "Falha no download: $_"
}

$sizeMB = [math]::Round((Get-Item "$AgentDir\$ExeName").Length / 1MB, 1)
Write-OK "Verificado: $sizeMB MB"

Write-Step "Criando config.json..."
$cfg = [ordered]@{
  api_base_url                = $ApiBaseUrl
  api_token                   = $ApiToken
  user_id                     = $UserId
  agent_version               = "0.1.0"
  sample_interval_sec         = 10
  heartbeat_interval_sec      = 30
  flush_interval_sec          = 20
  batch_size                  = 50
  idle_threshold_sec          = 300
  verify_tls                  = $false
  request_timeout_sec         = 10
  enable_screenshots          = $true
  screenshot_interval_sec     = 60
  screenshot_max_width        = 1600
  screenshot_quality          = 55
  screenshot_only_when_active = $true
  enable_recordings           = $true
  recording_interval_sec      = 120
  recording_duration_sec      = 20
  recording_fps               = 3
  recording_max_width         = 960
}
$cfg | ConvertTo-Json -Depth 3 | Set-Content "$AgentDir\config.json" -Encoding UTF8
Write-OK "config.json criado."

Write-Step "Registrando no Task Scheduler..."
$u = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>PAC CONTROL desktop agent</Description></RegistrationInfo>
  <Triggers>
    <LogonTrigger><Enabled>true</Enabled><UserId>$u</UserId><Delay>PT20S</Delay></LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$u</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Hidden>true</Hidden>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RestartOnFailure><Count>999</Count><Interval>PT1M</Interval></RestartOnFailure>
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
$tmp = "$env:TEMP\pac-task.xml"
[System.IO.File]::WriteAllText($tmp, $xml, [System.Text.Encoding]::Unicode)
schtasks /Create /TN $TaskName /XML $tmp /F | Out-Null
Remove-Item $tmp -ErrorAction SilentlyContinue
Write-OK "Task Scheduler configurado."

Write-Step "Iniciando agente..."
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 4

$running = (Get-Process -Name "PACControlAgent" -ErrorAction SilentlyContinue) -ne $null

Write-Host ""
if ($running) {
  Write-Host "=======================================" -ForegroundColor Green
  Write-Host "   INSTALADO E RODANDO COM SUCESSO!    " -ForegroundColor Green
  Write-Host "=======================================" -ForegroundColor Green
} else {
  Write-Host "  Instalado. Iniciara no proximo login." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Pasta : $AgentDir" -ForegroundColor White
Write-Host "  User  : $UserId" -ForegroundColor White
Write-Host ""
`;
}
