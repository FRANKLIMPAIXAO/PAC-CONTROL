# PAC CONTROL Agent — Guia de Instalação Windows

> **Tempo estimado:** 10–15 minutos por computador  
> **Sistema:** Windows 10 ou Windows 11  
> **Requisito:** Acesso à internet durante a instalação

---

## Antes de começar

Você vai precisar de **3 informações** do sistema PAC CONTROL para cada colaborador:

| Dado | Onde encontrar |
|---|---|
| **URL da API** | `https://controle.pactarefas.com.br` (sempre igual) |
| **Token do agente** | Painel → Configurações → Colaboradores → clique no colaborador → campo "Token do agente" |
| **User ID** | Painel → Configurações → Colaboradores → clique no colaborador → campo "ID do usuário" |

> Cada colaborador tem seu próprio Token e User ID. **Não use o mesmo para máquinas diferentes.**

---

## PASSO 1 — Instalar o Python

1. Acesse **https://python.org/downloads** no computador do colaborador
2. Clique em **"Download Python 3.x.x"** (versão mais recente)
3. Execute o instalador baixado
4. **IMPORTANTE:** Na primeira tela, marque a caixa **"Add Python to PATH"** antes de clicar em Install Now

   ```
   ☑ Add Python 3.x to PATH   ← MARQUE ESTA OPÇÃO
   ```

5. Clique em **"Install Now"**
6. Aguarde a instalação finalizar e clique em **"Close"**

**Verificar se instalou corretamente:**
- Abra o menu Iniciar, pesquise por "cmd" e abra o **Prompt de Comando**
- Digite: `python --version` e pressione Enter
- Deve aparecer algo como: `Python 3.12.0`
- Se aparecer erro, reinstale marcando "Add to PATH"

---

## PASSO 2 — Baixar os arquivos do agente

Copie os seguintes arquivos para uma pasta no computador do colaborador (ex: `Downloads`):

- `main.py`
- `install-windows.ps1`

> Esses arquivos estão disponíveis na pasta `agent-python/` do repositório ou enviados pelo administrador.

---

## PASSO 3 — Executar o instalador

1. Abra a pasta onde estão os arquivos
2. Clique com o botão direito em área vazia da pasta → **"Abrir no Terminal"** (ou "Abrir janela do PowerShell aqui")

   > Se não aparecer essa opção: pressione `Win + X` → selecione **"Terminal"** ou **"Windows PowerShell"** → navegue até a pasta com `cd C:\Users\SEU_USUARIO\Downloads`

3. Cole e execute o comando abaixo, substituindo os valores:

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -ApiBaseUrl "https://controle.pactarefas.com.br" `
  -ApiToken   "COLE_O_TOKEN_AQUI" `
  -UserId     "COLE_O_USER_ID_AQUI"
```

**Exemplo real:**
```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -ApiBaseUrl "https://controle.pactarefas.com.br" `
  -ApiToken   "c4a7f2e9b1d5a8f3c6e0b4d7a2f5c9e3" `
  -UserId     "1457500e-fc54-49d4-9cc9-925aa793a118"
```

4. Pressione **Enter** e aguarde. O instalador vai:
   - Criar a pasta `C:\PACControlAgent\`
   - Instalar as dependências Python automaticamente (~2 min com internet)
   - Registrar o agente para iniciar automaticamente no logon do Windows
   - Iniciar o agente imediatamente

**A instalação foi bem-sucedida quando aparecer:**
```
[INFO] === Instalacao concluida ===
[INFO] Tarefa registrada com sucesso.
[INFO] Agente iniciado e rodando.
```

---

## PASSO 4 — Verificar se está funcionando

Após a instalação, verifique no sistema PAC CONTROL:

1. Acesse o **Painel** com sua conta de administrador
2. Em até **2 minutos** o colaborador deve aparecer como **"Online"** no painel
3. Em até **60 segundos** o primeiro **screenshot** será enviado
4. Em até **2 minutos** a primeira **gravação de tela** será enviada

**Verificar pelo computador do colaborador:**
```powershell
# Ver se o agente está rodando
schtasks /Query /TN PACControlAgent

# Resultado esperado:
# Status: Em execucao (ou "Running")
```

---

## Onde ficam os arquivos instalados

```
C:\PACControlAgent\
├── main.py            ← código do agente
├── config.json        ← configuração (URL, token, user_id)
├── start-agent.vbs    ← inicializador silencioso
└── install.log        ← log da instalação
```

---

## Comandos úteis (PowerShell)

```powershell
# Verificar status
schtasks /Query /TN PACControlAgent

# Iniciar manualmente (se parado)
schtasks /Run /TN PACControlAgent

# Parar o agente
schtasks /End /TN PACControlAgent

# Desinstalar completamente
powershell -ExecutionPolicy Bypass -File C:\PACControlAgent\install-windows.ps1 -Uninstall
```

---

## Problemas comuns

### "Python não encontrado" durante a instalação
- Reinstale o Python marcando **"Add Python to PATH"**
- Ou reinicie o computador e tente novamente

### Agente instalou mas não aparece online no painel
- Verifique se há internet no computador
- Verifique se o Token e User ID foram copiados corretamente (sem espaços extras)
- Abra o PowerShell e execute: `schtasks /Run /TN PACControlAgent`

### "Erro de permissão" durante a instalação
- Execute o PowerShell como **Administrador**: Menu Iniciar → pesquise "PowerShell" → clique com botão direito → **"Executar como administrador"**

### Antivírus bloqueou o agente
- Adicione `C:\PACControlAgent\` como **exclusão** no antivírus
- Reexecute o instalador

### Agente some após reiniciar o computador
- O agente inicia automaticamente apenas após o **login do usuário**
- Confirme no Task Scheduler: Menu Iniciar → "Task Scheduler" → procure por "PACControlAgent"

---

## Desinstalação

Para remover completamente o agente de um computador:

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Uninstall
```

Isso remove a tarefa agendada e a pasta `C:\PACControlAgent\`.

---

## Deploy em vários computadores ao mesmo tempo

Para instalar em múltiplos PCs via **GPO, RMM ou script de rede**:

```powershell
# Rodar no contexto do usuário logado (não como SYSTEM)
powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden `
  -File "\\SERVIDOR\Compartilhado\install-windows.ps1" `
  -ApiBaseUrl "https://controle.pactarefas.com.br" `
  -ApiToken   "TOKEN_DO_USUARIO" `
  -UserId     "UUID_DO_USUARIO"
```

> **Atenção:** Cada máquina precisa do `-ApiToken` e `-UserId` do colaborador que usa aquele computador.  
> Se um colaborador usa mais de um computador, instale nos dois com o **mesmo** Token e User ID.

---

*PAC CONTROL Agent v0.1.0 — Suporte: paixaoassessoriacontabil@gmail.com*
