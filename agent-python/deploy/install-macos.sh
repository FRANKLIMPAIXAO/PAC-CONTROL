#!/usr/bin/env bash
# =============================================================================
# PAC CONTROL Agent — Instalador macOS
#
# Uso:
#   ./install-macos.sh --api-url URL --token TOKEN --user-id UUID
#
# Exemplo:
#   ./install-macos.sh \
#     --api-url  "https://controle.pactarefas.com.br" \
#     --token    "SEU_TOKEN" \
#     --user-id  "uuid-do-usuario"
#
# Desinstalar:
#   ./install-macos.sh --uninstall
#
# Nao precisa de sudo. Instala por usuario em:
#   ~/Library/Application Support/PACControlAgent/
# =============================================================================
set -euo pipefail

AGENT_DIR="$HOME/Library/Application Support/PACControlAgent"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/com.paccontrol.agent.plist"
LABEL="com.paccontrol.agent"
LOG_OUT="/tmp/pac-control-agent.out.log"
LOG_ERR="/tmp/pac-control-agent.err.log"

API_BASE_URL=""
API_TOKEN=""
USER_ID=""
AGENT_VERSION="0.1.0"
SAMPLE_INTERVAL=10
HEARTBEAT_INTERVAL=30
FLUSH_INTERVAL=20
BATCH_SIZE=50
IDLE_THRESHOLD=300
SCREENSHOT_INTERVAL=60
SCREENSHOT_MAX_WIDTH=1600
SCREENSHOT_QUALITY=55
UNINSTALL=false

# ─── PARSE ARGUMENTOS ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)       API_BASE_URL="$2"; shift 2 ;;
    --token)         API_TOKEN="$2"; shift 2 ;;
    --user-id)       USER_ID="$2"; shift 2 ;;
    --agent-dir)     AGENT_DIR="$2"; shift 2 ;;
    --uninstall)     UNINSTALL=true; shift ;;
    *) echo "Argumento desconhecido: $1"; exit 1 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ─── DESINSTALACAO ────────────────────────────────────────────────────────────
if $UNINSTALL; then
  log "Desinstalando PAC CONTROL Agent..."
  launchctl stop "$LABEL" 2>/dev/null || true
  launchctl unload "$PLIST_FILE" 2>/dev/null || true
  rm -f "$PLIST_FILE"
  rm -rf "$AGENT_DIR"
  log "Desinstalacao concluida."
  exit 0
fi

# ─── COLETA PARAMETROS INTERATIVAMENTE SE AUSENTES ───────────────────────────
if [[ -z "$API_BASE_URL" ]]; then
  read -rp "URL da API (ex: https://controle.pactarefas.com.br): " API_BASE_URL
fi
if [[ -z "$API_TOKEN" ]]; then
  read -rp "Token do agente: " API_TOKEN
fi
if [[ -z "$USER_ID" ]]; then
  read -rp "User ID (UUID do usuario): " USER_ID
fi

if [[ -z "$API_BASE_URL" || -z "$API_TOKEN" || -z "$USER_ID" ]]; then
  log "ERRO: api-url, token e user-id sao obrigatorios."
  exit 1
fi

log "=== Iniciando instalacao do PAC CONTROL Agent ==="
log "Diretorio: $AGENT_DIR"

# ─── DETECTA PYTHON 3.9+ ─────────────────────────────────────────────────────
find_python() {
  local candidates=("python3" "/usr/bin/python3" "/opt/homebrew/bin/python3"
    "/usr/local/bin/python3" "$HOME/.pyenv/shims/python3")
  for py in "${candidates[@]}"; do
    if command -v "$py" &>/dev/null || [[ -x "$py" ]]; then
      local ver
      ver=$("$py" -c "import sys; print(sys.version_info.minor)" 2>/dev/null)
      if [[ -n "$ver" ]] && (( ver >= 9 )); then
        echo "$py"
        return 0
      fi
    fi
  done
  return 1
}

log "Procurando Python 3.9+..."
PYTHON=$(find_python) || {
  log "ERRO: Python 3.9+ nao encontrado."
  log "Instale com: brew install python3"
  log "Ou baixe em: https://python.org"
  exit 1
}
log "Python encontrado: $PYTHON ($($PYTHON --version))"

# ─── CRIA DIRETORIO ───────────────────────────────────────────────────────────
mkdir -p "$AGENT_DIR"
log "Diretorio criado: $AGENT_DIR"

# ─── COPIA main.py ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_PY=""
for candidate in "$SCRIPT_DIR/../main.py" "$SCRIPT_DIR/main.py"; do
  if [[ -f "$candidate" ]]; then
    MAIN_PY="$(realpath "$candidate")"
    break
  fi
done

if [[ -z "$MAIN_PY" ]]; then
  log "ERRO: main.py nao encontrado. Coloque-o na mesma pasta do instalador ou na pasta pai."
  exit 1
fi

cp "$MAIN_PY" "$AGENT_DIR/main.py"
log "main.py copiado para $AGENT_DIR/main.py"

# ─── INSTALA DEPENDENCIAS ─────────────────────────────────────────────────────
log "Instalando dependencias Python..."
"$PYTHON" -m pip install --quiet --upgrade \
  "requests>=2.32" "psutil>=6.1" "pynput>=1.7" "mss>=9.0" "Pillow>=10.4" \
  "pyobjc-framework-Quartz>=10.3" \
  "numpy>=1.21" "imageio>=2.31" "imageio-ffmpeg>=0.4.9" \
  2>&1 | grep -v "^$" | grep -v "already satisfied" | head -20 || true
log "Dependencias instaladas."

# ─── CRIA config.json ─────────────────────────────────────────────────────────
log "Criando config.json..."
cat > "$AGENT_DIR/config.json" <<EOF
{
  "api_base_url":               "${API_BASE_URL%/}",
  "api_token":                  "$API_TOKEN",
  "user_id":                    "$USER_ID",
  "agent_version":              "$AGENT_VERSION",
  "sample_interval_sec":        $SAMPLE_INTERVAL,
  "heartbeat_interval_sec":     $HEARTBEAT_INTERVAL,
  "flush_interval_sec":         $FLUSH_INTERVAL,
  "batch_size":                 $BATCH_SIZE,
  "idle_threshold_sec":         $IDLE_THRESHOLD,
  "verify_tls":                 true,
  "request_timeout_sec":        10,
  "enable_screenshots":         true,
  "screenshot_interval_sec":    $SCREENSHOT_INTERVAL,
  "screenshot_max_width":       $SCREENSHOT_MAX_WIDTH,
  "screenshot_quality":         $SCREENSHOT_QUALITY,
  "screenshot_only_when_active": true,
  "enable_recordings":          false,
  "recording_interval_sec":     300,
  "recording_duration_sec":     20,
  "recording_fps":              3,
  "recording_max_width":        960
}
EOF
log "config.json criado."

# ─── CRIA LAUNCHAGENT PLIST ──────────────────────────────────────────────────
mkdir -p "$PLIST_DIR"
log "Criando LaunchAgent plist..."
cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON</string>
    <string>-u</string>
    <string>$AGENT_DIR/main.py</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PAC_AGENT_CONFIG</key>
    <string>$AGENT_DIR/config.json</string>
    <key>PYTHONUNBUFFERED</key>
    <string>1</string>
  </dict>

  <key>WorkingDirectory</key>
  <string>$AGENT_DIR</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>ThrottleInterval</key>
  <integer>30</integer>

  <key>StandardOutPath</key>
  <string>$LOG_OUT</string>

  <key>StandardErrorPath</key>
  <string>$LOG_ERR</string>
</dict>
</plist>
EOF
log "Plist criado: $PLIST_FILE"

# ─── REGISTRA E INICIA ────────────────────────────────────────────────────────
log "Registrando e iniciando LaunchAgent..."
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"
sleep 2

STATUS=$(launchctl list | grep "$LABEL" || echo "")
if [[ -n "$STATUS" ]]; then
  PID=$(echo "$STATUS" | awk '{print $1}')
  if [[ "$PID" != "-" && "$PID" != "0" ]]; then
    log "Agente rodando (PID $PID)."
  else
    log "Agente registrado (iniciara no proximo login ou em breve)."
  fi
else
  log "AVISO: nao foi possivel confirmar status. Verifique: launchctl list | grep paccontrol"
fi

log ""
log "=== Instalacao concluida ==="
log "  Diretorio  : $AGENT_DIR"
log "  Config     : $AGENT_DIR/config.json"
log "  Log stdout : $LOG_OUT"
log "  Log stderr : $LOG_ERR"
log ""
log "Comandos uteis:"
log "  Ver status    : launchctl list | grep paccontrol"
log "  Ver logs      : tail -f $LOG_OUT"
log "  Reiniciar     : launchctl kickstart -k gui/\$(id -u)/$LABEL"
log "  Parar         : launchctl stop $LABEL"
log "  Desinstalar   : $SCRIPT_DIR/install-macos.sh --uninstall"
