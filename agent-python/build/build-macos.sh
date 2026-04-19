#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
VERSION="${2:-0.1.0}"
IDENTIFIER="com.paccontrol.agent"
APP_NAME="PACControlAgent"
PKG_NAME="PACControlAgent-${VERSION}.pkg"

cd "$PROJECT_ROOT"

echo "[PAC CONTROL] Build macOS iniciado em $(pwd)"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install -r build/requirements-build.txt

rm -rf build/tmp build/out dist/macos
mkdir -p build/tmp build/out dist/macos/payload/opt/pac-control-agent dist/macos/payload/Library/LaunchAgents

python -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --console \
  --name "$APP_NAME" \
  --distpath "dist/macos/payload/opt/pac-control-agent" \
  --workpath "build/tmp" \
  --specpath "build/out" \
  --add-data "$(pwd)/config.example.json:." \
  main.py

cp requirements.txt dist/macos/payload/opt/pac-control-agent/requirements.txt
cp config.example.json dist/macos/payload/opt/pac-control-agent/config.example.json
cp deploy/com.paccontrol.agent.plist dist/macos/payload/Library/LaunchAgents/com.paccontrol.agent.plist
cp deploy/install-macos-launchagent.sh dist/macos/payload/opt/pac-control-agent/install-macos-launchagent.sh
chmod +x dist/macos/payload/opt/pac-control-agent/install-macos-launchagent.sh

pkgbuild \
  --root dist/macos/payload \
  --identifier "$IDENTIFIER" \
  --version "$VERSION" \
  --install-location / \
  "dist/macos/$PKG_NAME"

echo "[PAC CONTROL] Build macOS concluido em dist/macos/$PKG_NAME"
echo "Assinatura/notarizacao (recomendado em producao) deve ser feita apos este passo."
