#Requires -Version 5.1
<#
.SYNOPSIS
    Gera o executavel PACControlAgent.exe para Windows usando PyInstaller.

.DESCRIPTION
    Deve ser executado UMA VEZ em um PC Windows com Python 3.9+ instalado.
    O .exe gerado pode ser distribuido para qualquer Windows 10/11 sem precisar
    instalar Python.

.EXAMPLE
    # Rodar na pasta agent-python/
    .\deploy\build-windows.ps1
#>

$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentRoot  = Split-Path -Parent $ScriptDir   # pasta agent-python/
$MainPy     = Join-Path $AgentRoot "main.py"
$DistDir    = Join-Path $AgentRoot "dist\windows"
$ExeName    = "PACControlAgent"

function Write-Step { param([string]$Msg) Write-Host "`n>>> $Msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$Msg) Write-Host "    OK: $Msg" -ForegroundColor Green }
function Write-Fail { param([string]$Msg) Write-Host "    ERRO: $Msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "   PAC CONTROL Agent — Build Windows     " -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

# ─── VERIFICA PYTHON ─────────────────────────────────────────────────────────
Write-Step "Verificando Python..."
try {
    $ver = python --version 2>&1
    Write-OK $ver
} catch {
    Write-Fail "Python nao encontrado. Instale em https://python.org com 'Add to PATH'."
}

# ─── INSTALA DEPENDENCIAS + PYINSTALLER ──────────────────────────────────────
Write-Step "Instalando dependencias e PyInstaller..."
$deps = @(
    "pyinstaller>=6.0",
    "requests>=2.32",
    "psutil>=6.1",
    "pynput>=1.7",
    "mss>=9.0",
    "Pillow>=10.4",
    "imageio[ffmpeg]>=2.34",
    "numpy>=1.26"
)
foreach ($dep in $deps) {
    Write-Host "  pip install $dep" -ForegroundColor Gray
    python -m pip install --quiet --upgrade $dep
    if ($LASTEXITCODE -ne 0) { Write-Fail "Falha ao instalar $dep" }
}
Write-OK "Dependencias prontas."

# ─── BUILD COM PYINSTALLER ───────────────────────────────────────────────────
Write-Step "Gerando $ExeName.exe com PyInstaller..."
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

$pyiArgs = @(
    "--onefile",
    "--noconsole",                          # sem janela de console
    "--name", $ExeName,
    "--distpath", $DistDir,
    "--workpath", "$AgentRoot\build\windows",
    "--specpath", "$AgentRoot\build",
    "--hidden-import", "pynput.keyboard._win32",
    "--hidden-import", "pynput.mouse._win32",
    "--hidden-import", "PIL._imaging",
    "--hidden-import", "imageio_ffmpeg",
    "--collect-all", "imageio",
    "--collect-all", "imageio_ffmpeg",
    $MainPy
)

pyinstaller @pyiArgs
if ($LASTEXITCODE -ne 0) { Write-Fail "PyInstaller falhou. Veja os erros acima." }

$ExePath = Join-Path $DistDir "$ExeName.exe"
if (-not (Test-Path $ExePath)) {
    Write-Fail "Executavel nao encontrado em: $ExePath"
}

$sizeMB = [math]::Round((Get-Item $ExePath).Length / 1MB, 1)
Write-OK "Executavel gerado: $ExePath ($sizeMB MB)"

# ─── COPIA INSTALADOR PARA dist/windows/ ─────────────────────────────────────
Write-Step "Copiando instalador para $DistDir..."
Copy-Item -Force (Join-Path $ScriptDir "install-windows-exe.ps1") $DistDir
Copy-Item -Force (Join-Path $ScriptDir "GUIA-INSTALACAO-WINDOWS.md") $DistDir
Write-OK "Arquivos copiados."

# ─── RESUMO ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "   BUILD CONCLUIDO COM SUCESSO           " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos para distribuir (pasta $DistDir):" -ForegroundColor White
Write-Host "  PACControlAgent.exe       <- o agente compilado" -ForegroundColor White
Write-Host "  install-windows-exe.ps1   <- instalador simplificado" -ForegroundColor White
Write-Host "  GUIA-INSTALACAO-WINDOWS.md" -ForegroundColor White
Write-Host ""
Write-Host "Envie os 2 primeiros arquivos por e-mail para cada colaborador." -ForegroundColor Yellow
Write-Host ""
