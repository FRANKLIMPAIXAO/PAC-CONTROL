# PAC CONTROL - Diario de Debug (2026-04-19)

## Objetivo do dia
- Finalizar captura de screenshots no agente macOS.
- Exibir capturas no painel admin.
- Melhorar layout para analise por usuario.
- Garantir persistencia/entrega das imagens em producao.
- Corrigir captura de desktop incorreta e agente parado.
- Suporte a multiplos monitores.
- Criar instaladores automaticos para macOS e Windows.

---

## Resumo do que foi implementado no codigo

### Backend / Web
1. Endpoint de upload de screenshot:
   - `POST /api/agent/screenshot`
   - Arquivo: `app/api/agent/screenshot/route.js`

2. Endpoint de leitura de screenshot:
   - `GET /api/screenshots/[id]`
   - Arquivo: `app/api/screenshots/[id]/route.js`

3. Pagina de analises reestruturada por blocos de usuario:
   - Arquivo: `app/(dashboard)/reports/page.js`

4. Galeria dedicada de screenshots com filtro:
   - URL: `/reports/screenshots`
   - Arquivo: `app/(dashboard)/reports/screenshots/page.js`

5. Ajuste para servir imagem do banco (sem depender de volume):
   - `image_bytes` em `screenshot_events`
   - Fallback opcional para `file_path`

### Banco
Migrations criadas:
- `supabase/migrations/20260419_003_screenshot_events.sql`
- `supabase/migrations/20260419_004_screenshot_bytes.sql`

### Agente Python — `agent-python/main.py`

#### Correcoes de screenshot (sessao do dia)

**Problema 1 — Agente parou de enviar screenshots**
- Causa raiz: filtro `if not kCGWindowName: continue` em `_find_macos_window_id`
  eliminava janelas sem nome — comportamento comum em apps modernos (Electron, browsers).
- Fix: removido o filtro. A janela e selecionada por `layer=0`, `alpha>0` e `area>20000`.

**Problema 2 — Capturava area de trabalho/desktop**
- Causa raiz: `_skip_apps` nao cobria todos os apps de sistema.
- Fix: adicionado `"desktop"`, `"wallpaper"`, `"notificationcenter"`,
  `"notification center"`, `"window server"`.

**Problema 3 — Retornava None silenciosamente quando janela nao encontrada**
- Fix: quando `_find_macos_window_id` retorna `None` para um app valido,
  agora cai em `_capture_fullscreen()` em vez de abortar.

**Suporte a multiplos monitores**
- Windows: `_get_active_monitor_windows()` usa `MonitorFromWindow` + `GetMonitorInfoW`
  para detectar o monitor onde esta a janela em foco.
- macOS fallback: `_get_active_monitor_macos()` usa `CGGetActiveDisplayList` +
  `CGDisplayBounds` para achar o display correto pelo centro da janela.
- `_capture_fullscreen()` agora recebe `app_name` e captura o monitor correto.
  Fallback para monitor primario se nao detectar.
- Testado com 2 monitores: capturou monitor externo (1080x1920) corretamente.

**Log em arquivo no Windows**
- `_setup_file_logging()`: no Windows, redireciona `stdout`/`stderr` para
  `C:\PACControlAgent\agent.log` (necessario pois `pythonw.exe` nao tem terminal).

### Instaladores — `agent-python/deploy/`

#### `install-macos.sh`
- Nao precisa de sudo.
- Instala em `~/Library/Application Support/PACControlAgent/`.
- Detecta Python 3.9+ (system, Homebrew, pyenv).
- Instala dependencias via `pip` automaticamente.
- Cria `config.json` com todos os parametros.
- Registra LaunchAgent em `~/Library/LaunchAgents/com.paccontrol.agent.plist`.
- `KeepAlive: true` — reinicia sozinho se o processo morrer.
- `RunAtLoad: true` — inicia no login do usuario.
- `ThrottleInterval: 30` — evita restart em loop rapido.
- Inicia o agente imediatamente apos instalacao.
- Suporte a `--uninstall` para remocao completa.

Uso:
```bash
./install-macos.sh \
  --api-url "https://controle.pactarefas.com.br" \
  --token   "TOKEN" \
  --user-id "UUID-DO-USUARIO"
```

#### `install-windows.ps1`
- Nao precisa de administrador para a maioria das operacoes.
- Instala em `C:\PACControlAgent\`.
- Detecta Python 3.9+ em multiplos caminhos + `py launcher`.
- Instala dependencias via `pip`.
- Cria `config.json`.
- Cria `start-agent.vbs` (wrapper sem janela visivel).
- Registra tarefa no Task Scheduler via XML:
  - Logon do usuario atual.
  - `Hidden: true`.
  - `RestartOnFailure: 999x / 1 minuto`.
  - `ExecutionTimeLimit: PT0S` (sem limite de tempo).
- Suporte a `-Uninstall` para remocao completa.
- Adequado para deploy em massa via GPO / RMM.

Uso:
```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -ApiBaseUrl "https://controle.pactarefas.com.br" `
  -ApiToken   "TOKEN" `
  -UserId     "UUID-DO-USUARIO"
```

---

## Commits realizados
- `15ef6ea` feat(screenshots): capture and display admin-only screen snapshots
- `661405f` feat(reports): organiza capturas por usuario com galeria filtravel
- `bcf1789` fix(screenshots): serve imagens do banco sem depender de volume
- `ce2e52d` feat(agent-macos): captura apenas janela ativa e ignora desktop/finder
- `7cbf757` fix(agent-macos): melhora captura da janela ativa e retry de dominio

---

## Estado atual (fim do dia)

### O que esta OK
- API de screenshot responde `200` em producao.
- Tabela `screenshot_events` recebe dados.
- Painel `/reports/screenshots` lista capturas.
- Miniaturas aparecem no frontend (incluindo imagens recentes).
- Agente envia screenshots periodicamente (testado: 2 ciclos consecutivos confirmados).
- Multiplos monitores: captura o monitor correto (testado com 2 telas).
- Instalador macOS: testado end-to-end, agente subiu com PID e enviou screenshots.
- Instalador Windows: criado e validado logicamente (requer maquina Windows para teste final).

### Problemas resolvidos hoje
| Problema | Causa | Fix |
|---|---|---|
| Agente parou de enviar | Filtro `kCGWindowName` eliminava janelas sem nome | Removido filtro |
| Capturava desktop | `_skip_apps` incompleto | Lista expandida |
| Retornava None silenciosamente | Sem fallback para fullscreen | Fallback adicionado |
| Monitor errado em dual-screen | Sempre capturava `monitors[1]` fixo | Deteccao por janela ativa |
| Sem log no Windows | `pythonw.exe` nao tem terminal | `_setup_file_logging()` |

### Problemas ainda em aberto
1. `site nao identificado` para apps que nao sao navegador ou sem permissao de Automacao.
2. Warnings de `NotOpenSSLWarning` e `This process is not trusted` nos logs (cosmético).
3. Token `AGENT_BOOTSTRAP_TOKEN` foi exposto — **recomendado girar**.

---

## Causa raiz importante identificada
- Existia binario antigo (PyInstaller) rodando em alguns momentos.
- Erro: `TypeError: __init__() got an unexpected keyword argument 'enable_screenshots'`
- Causa: versao antiga do agente lendo config novo.

---

## Config esperada do agente
Arquivo: `$AGENT_DIR/config.json`

```json
{
  "api_base_url":               "https://controle.pactarefas.com.br",
  "api_token":                  "TOKEN",
  "user_id":                    "UUID",
  "agent_version":              "0.1.0",
  "sample_interval_sec":        10,
  "heartbeat_interval_sec":     30,
  "flush_interval_sec":         20,
  "batch_size":                 50,
  "idle_threshold_sec":         300,
  "verify_tls":                 true,
  "request_timeout_sec":        10,
  "enable_screenshots":         true,
  "screenshot_interval_sec":    60,
  "screenshot_max_width":       1600,
  "screenshot_quality":         55,
  "screenshot_only_when_active": true
}
```

---

## Comandos uteis

### macOS
```bash
# Ver status
launchctl list | grep paccontrol

# Ver logs
tail -f /tmp/pac-control-agent.out.log
tail -f /tmp/pac-control-agent.err.log

# Reiniciar
launchctl kickstart -k gui/$(id -u)/com.paccontrol.agent

# Parar / iniciar
launchctl stop com.paccontrol.agent
launchctl start com.paccontrol.agent

# Ultimas capturas no banco
# select ts, app_name, size_bytes from screenshot_events order by ts desc limit 10;
```

### Windows
```powershell
# Ver status
schtasks /Query /TN PACControlAgent

# Iniciar / parar
schtasks /Run /TN PACControlAgent
schtasks /End /TN PACControlAgent

# Ver log
type C:\PACControlAgent\agent.log
```

---

## Proximos passos
1. **Gravacao de tela** — captura de video curto (buffer de X segundos) em vez de apenas screenshots estaticos.
2. Resolver `site nao identificado` via permissao de Automacao no macOS.
3. Girar `AGENT_BOOTSTRAP_TOKEN` no servidor.
4. Teste do instalador Windows em maquina real.
