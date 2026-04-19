#!/usr/bin/env bash
set -euo pipefail

PLIST_SRC="/Library/LaunchAgents/com.paccontrol.agent.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.paccontrol.agent.plist"

if [ ! -f "$PLIST_SRC" ]; then
  echo "Arquivo nao encontrado: $PLIST_SRC"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl unload "$PLIST_DST" >/dev/null 2>&1 || true
launchctl load "$PLIST_DST"

echo "PAC CONTROL Agent habilitado no login do usuario atual."
