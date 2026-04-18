-- Monitoring MVP schema (Supabase/Postgres)
create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create type user_role as enum ('admin', 'rh', 'gestor', 'colaborador');

create table if not exists users (
  id uuid primary key,
  company_id uuid not null references companies(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  email text unique not null,
  role user_role not null default 'colaborador',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  hostname text not null,
  os text not null,
  agent_version text,
  is_active boolean not null default true,
  last_idle_state boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, hostname)
);

create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip text,
  unique(user_id, version)
);

create table if not exists events_raw (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  ts timestamptz not null,
  event_type text not null,
  app_name text,
  url_domain text,
  window_hash text,
  is_idle boolean not null default false,
  keys_count integer not null default 0,
  mouse_count integer not null default 0,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_classification (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  app_or_domain text not null,
  category text not null check (category in ('productive', 'neutral', 'unproductive')),
  score smallint not null default 50 check (score between 0 and 100),
  unique(company_id, app_or_domain)
);

create table if not exists metrics_minute (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  minute_ts timestamptz not null,
  productive_sec integer not null default 0,
  neutral_sec integer not null default 0,
  unproductive_sec integer not null default 0,
  idle_sec integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, device_id, minute_ts)
);

create table if not exists metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  productive_sec integer not null default 0,
  neutral_sec integer not null default 0,
  unproductive_sec integer not null default 0,
  idle_sec integer not null default 0,
  focus_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, day)
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  resource text not null,
  resource_id text,
  ip text,
  metadata_json jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

create table if not exists retention_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references companies(id) on delete cascade,
  raw_days integer not null default 90,
  aggregate_days integer not null default 730,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_raw_user_ts on events_raw(user_id, ts desc);
create index if not exists idx_events_raw_device_ts on events_raw(device_id, ts desc);
create index if not exists idx_metrics_daily_day on metrics_daily(day desc);
create index if not exists idx_devices_last_seen on devices(last_seen_at desc);

alter table companies enable row level security;
alter table teams enable row level security;
alter table users enable row level security;
alter table devices enable row level security;
alter table consents enable row level security;
alter table events_raw enable row level security;
alter table app_classification enable row level security;
alter table metrics_minute enable row level security;
alter table metrics_daily enable row level security;
alter table alerts enable row level security;
alter table audit_logs enable row level security;
alter table retention_policies enable row level security;

-- Minimal baseline policy for authenticated users (tighten per role later)
create policy if not exists "users can read own profile"
  on users for select
  to authenticated
  using (id = auth.uid());

create policy if not exists "users can read own events"
  on events_raw for select
  to authenticated
  using (user_id = auth.uid());

create policy if not exists "users can read own daily metrics"
  on metrics_daily for select
  to authenticated
  using (user_id = auth.uid());

-- Service role bypasses RLS automatically in Supabase.
