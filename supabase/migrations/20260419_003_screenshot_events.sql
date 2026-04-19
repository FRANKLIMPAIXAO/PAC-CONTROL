create table if not exists screenshot_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  ts timestamptz not null,
  app_name text,
  url_domain text,
  is_idle boolean not null default false,
  mime_type text not null,
  file_path text not null,
  sha256 text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_screenshot_events_user_ts
  on screenshot_events (user_id, ts desc);

create index if not exists idx_screenshot_events_device_ts
  on screenshot_events (device_id, ts desc);

create index if not exists idx_screenshot_events_domain
  on screenshot_events (url_domain);
