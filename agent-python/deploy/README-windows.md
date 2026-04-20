# PAC CONTROL Agent — Instalação Windows

## Pré-requisitos

- Windows 10/11
- Python 3.9+ instalado → https://python.org (marcar **"Add Python to PATH"**)
- Acesso à internet para baixar dependências

---

## Instalação em um computador

1. Copie a pasta `deploy/` e o `main.py` para o computador de destino.
2. Abra o **PowerShell como Administrador** (ou usuário normal com permissão de escrita em `C:\`).
3. Execute:

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -ApiBaseUrl "https://controle.pactarefas.com.br" `
  -ApiToken   "TOKEN_DO_AGENTE" `
  -UserId     "UUID_DO_USUARIO"
```

O instalador vai:
- Criar `C:\PACControlAgent\`
- Instalar dependências Python (`pip install`)
- Criar `config.json`
- Registrar tarefa no **Task Scheduler** que inicia no logon do usuário
- Iniciar o agente imediatamente

---

## Deploy em massa (GPO / RMM)

Para instalar em vários computadores sem interação, use parâmetros na linha de comando:

```powershell
powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden `
  -File "\\servidor\compartilhado\install-windows.ps1" `
  -ApiBaseUrl "https://controle.pactarefas.com.br" `
  -ApiToken   "TOKEN_DO_AGENTE" `
  -UserId     "UUID_DO_USUARIO"
```

> **Nota:** Cada computador deve ter um `UserId` diferente (UUID do usuário cadastrado no sistema).

---

## Comandos úteis (PowerShell ou CMD)

```powershell
# Verificar se está rodando
schtasks /Query /TN PACControlAgent

# Iniciar manualmente
schtasks /Run /TN PACControlAgent

# Parar
schtasks /End /TN PACControlAgent

# Ver log do agente
type C:\PACControlAgent\agent.log

# Desinstalar
powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Uninstall
```

---

## Estrutura de arquivos instalados

```
C:\PACControlAgent\
├── main.py            ← agente Python
├── config.json        ← configuracao (API URL, token, user_id)
├── start-agent.vbs    ← wrapper para iniciar sem janela visivel
├── agent.log          ← log do agente (criado automaticamente)
└── install.log        ← log da instalacao
```

---

## Solução de problemas

| Problema | Solução |
|---|---|
| Agente não inicia | Verificar `C:\PACControlAgent\agent.log` |
| Python não encontrado | Reinstalar Python com "Add to PATH" marcado |
| Erro de permissão | Rodar PowerShell como Administrador |
| Tarefa some após reiniciar | Confirmar que o usuário tem sessão ativa |
| Screenshots não enviados | Verificar se o usuário tem sessão de tela ativa (não RDP minimizado) |
