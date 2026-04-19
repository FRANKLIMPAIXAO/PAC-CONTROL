param(
  [string]$ProjectRoot = ".",
  [string]$PythonExe = "python",
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path $ProjectRoot
Set-Location $Root

Write-Host "[PAC CONTROL] Build Windows iniciado em $Root"

if (-not (Test-Path ".venv")) {
  & $PythonExe -m venv .venv
}

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
$VenvPip = Join-Path $Root ".venv\Scripts\pip.exe"

& $VenvPip install --upgrade pip
& $VenvPip install -r requirements.txt
& $VenvPip install -r build/requirements-build.txt

Remove-Item -Recurse -Force build\tmp, build\out, dist\windows -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path build\out, dist\windows | Out-Null

& $VenvPython -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --console `
  --name "PACControlAgent" `
  --distpath "dist/windows" `
  --workpath "build/tmp" `
  --specpath "build/out" `
  --version-file "build/windows-version.txt" `
  --add-data "$Root\config.example.json;." `
  main.py

Copy-Item requirements.txt dist/windows/requirements.txt -Force
Copy-Item config.example.json dist/windows/config.example.json -Force
Copy-Item deploy/install-windows-task.ps1 dist/windows/install-windows-task.ps1 -Force

Write-Host "[PAC CONTROL] Build Windows concluido em dist/windows"
