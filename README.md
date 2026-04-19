# PAC CONTROL (Supabase + Vercel + Next.js)

Projeto completo para 10 colaboradores com:
- login por email/senha
- perfis `admin`, `rh`, `gestor`, `colaborador`
- dashboard e relatorios
- APIs de agente desktop (register/heartbeat/events/screenshot)
- cron de agregacao diaria e retencao

## Stack
- Next.js (App Router)
- Supabase (Postgres + RLS)
- Vercel (deploy)

## Estrutura principal
- `app/(auth)/login/*` login web
- `app/(dashboard)/dashboard/page.js` dashboard
- `app/(dashboard)/reports/page.js` relatorio por colaborador
- `app/api/auth/*` login/logout
- `app/api/agent/*` endpoints do agente desktop
- `app/api/reports/*` endpoints de relatorio
- `app/api/cron/daily-rollup` agregacao diaria
- `supabase/migrations/*` schema e auth
- `supabase/seed.sql` empresa/team/admin inicial

## 1) Configuracao
1. Copie `.env.example` para `.env.local`
2. Preencha variaveis:
   - `SESSION_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AGENT_BOOTSTRAP_TOKEN`
   - `DASHBOARD_API_TOKEN`

## 2) Banco Supabase
1. Rode `supabase/migrations/20260417_001_monitoring_init.sql`
2. Rode `supabase/migrations/20260417_002_auth_seed.sql`
3. Rode `supabase/seed.sql`

Depois disso, login inicial:
- email: `admin@empresa.com`
- senha: `TroqueEssaSenha123!`

Troque imediatamente no banco em producao.

## 3) Rodar local
```bash
npm install
npm run dev
```
Abrir: `http://localhost:3000/login`

## 4) Endpoints principais
### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Agente desktop
- `POST /api/agent/register-device`
- `POST /api/agent/heartbeat`
- `POST /api/agent/events-batch`
- `POST /api/agent/screenshot`

Header exigido nos endpoints do agente:
```http
Authorization: Bearer <AGENT_BOOTSTRAP_TOKEN>
```

### Relatorios
- `GET /api/reports/user?from=YYYY-MM-DD&to=YYYY-MM-DD&user_id=<uuid>`
- `GET /api/reports/team?from=YYYY-MM-DD&to=YYYY-MM-DD&team_id=<uuid>`

### Cron
- `POST /api/cron/daily-rollup`

Header exigido:
```http
Authorization: Bearer <DASHBOARD_API_TOKEN>
```

## 5) Vercel deploy
1. Importar pasta `monitoring-mvp` como novo projeto
2. Framework: Next.js
3. Configurar envs no painel
4. Deploy
5. Configurar Vercel Cron para chamar `/api/cron/daily-rollup` diariamente

## 6) LGPD minimo
- Aviso formal + consentimento do colaborador
- Sem keylogger e sem captura de conteudo digitado
- Se habilitar screenshot, documentar finalidade e politica interna de acesso/retenção
- Controle de acesso por perfil
- Auditoria e retencao de dados

## 7) Agente Desktop em Python
- Pasta: `agent-python/`
- Guia: `agent-python/README.md`
- Script principal: `agent-python/main.py`

Comandos rapidos:
```bash
cd agent-python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.json config.json
python main.py
```
