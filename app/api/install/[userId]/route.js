import sql from '@/lib/db';

const MAIN_PY_URL =
  'https://raw.githubusercontent.com/FRANKLIMPAIXAO/PAC-CONTROL/main/agent-python/main.py';

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

  return new Response(generateScript({ userId, token, apiBaseUrl, mainPyUrl: MAIN_PY_URL }), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="instalar-agente.ps1"',
    },
  });
}

function generateScript({ userId, token, apiBaseUrl, mainPyUrl }) {
  return `#Requires -Version 5.1
# PAC CONTROL Agent - Instalador automatico
# Gerado pelo painel PAC CONTROL

$AgentDir   = "C:\\PACControlAgent"
$TaskName   = "PACControlAgent"
$MainPyUrl  = "${mainPyUrl}"
$ApiToken   = "${token}"
$UserId     = "${userId}"
$ApiBaseUrl = "${apiBaseUrl}"

function Write-Step { param([string]$M) Write-Host "  >> $M" -ForegroundColor Cyan }
function Write-OK   { param([string]$M) Write-Host "  OK: $M" -ForegroundColor Green }
function Write-Fail { param([string]$M) Write-Host "  ERRO: $M" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "   PAC CONTROL Agent - Instalacao      " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Para agente anterior
$prevErr = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
schtasks /End    /TN $TaskName | Out-Null
schtasks /Delete /TN $TaskName /F | Out-Null
$ErrorActionPreference = $prevErr
Start-Sleep -Seconds 1

Write-Step "Criando diretorio..."
if (-not (Test-Path $AgentDir)) { New-Item -ItemType Directory -Path $AgentDir | Out-Null }

# Verifica Python
Write-Step "Verificando Python..."
$py = $null
foreach ($c in @("py","python","python3")) {
  try {
    $v = & $c --version 2>&1
    if ($v -match "Python 3\\.([89]|1[0-9])") { $py = $c; break }
  } catch {}
}
if (-not $py) { Write-Fail "Python 3.9+ nao encontrado. Instale em https://python.org marcando 'Add to PATH'." }
Write-OK "Python: $(& $py --version 2>&1)"

Write-Step "Baixando main.py..."
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $MainPyUrl -OutFile "$AgentDir\\main.py" -UseBasicParsing
  Write-OK "main.py baixado."
} catch { Write-Fail "Falha no download: $_" }

Write-Step "Instalando dependencias Python (pode demorar ~2 min na primeira vez)..."
& $py -m pip install --quiet --upgrade requests psutil pynput mss Pillow
if ($LASTEXITCODE -ne 0) { Write-Fail "pip falhou (Python usado: $(& $py -c 'import sys; print(sys.executable)')). Instale o Python oficial de python.org." }
Write-OK "Dependencias instaladas."

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
  verify_tls                  = $true
  request_timeout_sec         = 10
  enable_screenshots          = $true
  screenshot_interval_sec     = 60
  screenshot_max_width        = 1600
  screenshot_quality          = 55
  screenshot_only_when_active = $true
  enable_recordings           = $false
}
$cfg | ConvertTo-Json -Depth 3 | Set-Content "$AgentDir\\config.json" -Encoding UTF8
Write-OK "config.json criado."

# Wrapper VBS silencioso (sem janela preta)
$pyPath = (& $py -c "import sys; print(sys.executable)" 2>&1).Trim()
$wpy = $pyPath -replace "python\.exe$","pythonw.exe"
if (-not (Test-Path $wpy)) { $wpy = $pyPath }
@"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$AgentDir"
sh.Environment("Process")("PAC_AGENT_CONFIG") = "$AgentDir\config.json"
sh.Run """$wpy"" ""$AgentDir\main.py""", 0, False
"@ | Set-Content "$AgentDir\\start-agent.vbs" -Encoding UTF8

Write-Step "Registrando no Task Scheduler..."
$u = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>PAC CONTROL desktop agent</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>$u</UserId><Delay>PT20S</Delay></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>$u</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Hidden>true</Hidden><StartWhenAvailable>true</StartWhenAvailable>
    <RestartOnFailure><Count>999</Count><Interval>PT1M</Interval></RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>wscript.exe</Command><Arguments>"$AgentDir\\start-agent.vbs"</Arguments><WorkingDirectory>$AgentDir</WorkingDirectory></Exec>
  </Actions>
</Task>
"@
$tmp = "$env:TEMP\\pac-task.xml"
[System.IO.File]::WriteAllText($tmp, $xml, [System.Text.Encoding]::Unicode)
schtasks /Create /TN $TaskName /XML $tmp /F | Out-Null
Remove-Item $tmp -ErrorAction SilentlyContinue
Write-OK "Task Scheduler configurado."

Write-Step "Iniciando agente agora..."
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host "   INSTALACAO CONCLUIDA!               " -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Pasta  : $AgentDir" -ForegroundColor White
Write-Host "  Agente : Iniciara automaticamente no proximo login" -ForegroundColor White
Write-Host ""
Write-Host "Verifique em ~2 minutos se o usuario aparece Online no painel." -ForegroundColor Yellow
Write-Host ""
`;
}
