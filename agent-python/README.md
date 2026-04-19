# PAC CONTROL Agent (Python)

Agente desktop MVP para enviar atividade para o PAC CONTROL.

## O que coleta
- `app_name` em foco
- `url_domain` do navegador ativo (quando permitido no sistema)
- `window_hash` (hash SHA-256 do titulo da janela)
- `is_idle` por tempo sem interacao
- `keys_count` e `mouse_count` em modo estatistico

## O que NAO coleta
- conteudo digitado
- captura de tela
- conteudo integral de janela

## Requisitos
- Python 3.10+
- Token `AGENT_BOOTSTRAP_TOKEN` configurado no servidor
- `user_id` do colaborador existente na tabela `users`

## Instalacao
```bash
cd agent-python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.json config.json
```

Edite o `config.json` com:
- `api_base_url` (ex: `https://controle.pactarefas.com.br`)
- `api_token`
- `user_id`

## Execucao
```bash
cd agent-python
source .venv/bin/activate
python main.py
```

## Execucao com config customizado
```bash
PAC_AGENT_CONFIG=/caminho/agent-config.json python main.py
```

## Endpoints usados
- `POST /api/agent/register-device`
- `POST /api/agent/heartbeat`
- `POST /api/agent/events-batch`

## Observacoes por SO
- Windows: detecta app/titulo da janela e idle nativo.
- macOS: detecta app frontmost via `osascript`; idle via Quartz; tenta capturar dominio do navegador ativo (Chrome/Safari/Edge/Brave/Arc/Opera/Vivaldi) via automacao.
- Linux: fallback com `xdotool`/`xprintidle` quando instalados.

## Permissoes no macOS para capturar sites
Para preencher `url_domain`, o macOS pode pedir permissao de automacao para o agente controlar o navegador.
Se negar, o agente continua funcionando, mas sem dominio.

Passos:
1. Ajustes do Sistema -> Privacidade e Seguranca -> Automacao
2. Permitir `PACControlAgent` controlar os navegadores usados
3. Reiniciar o agente:
```bash
launchctl kickstart -k gui/$(id -u)/com.paccontrol.agent
```

## Producao
- Rodar como servico do sistema (systemd no Linux, Task Scheduler no Windows, LaunchAgent no macOS).
- Fixar versao do agente e distribuir por instalador interno.
- Registrar aceite do colaborador antes de iniciar coleta.

## Build para distribuicao

### Windows (.exe)
```powershell
cd agent-python
powershell -ExecutionPolicy Bypass -File build/build-windows.ps1
```
Saida:
- `dist/windows/PACControlAgent.exe`
- `dist/windows/install-windows-task.ps1`

### macOS (.pkg)
```bash
cd agent-python
chmod +x build/build-macos.sh
./build/build-macos.sh . 0.1.0
```
Saida:
- `dist/macos/PACControlAgent-0.1.0.pkg`

## Pos-instalacao

### Windows
Executar como admin:
```powershell
powershell -ExecutionPolicy Bypass -File install-windows-task.ps1
```

### macOS
Depois de instalar o `.pkg`:
```bash
/opt/pac-control-agent/install-macos-launchagent.sh
```

## Assinatura digital (recomendado)
- Windows: assinar `PACControlAgent.exe` com certificado code-signing.
- macOS: assinar e notarizar o `.pkg` para evitar bloqueios do Gatekeeper.
