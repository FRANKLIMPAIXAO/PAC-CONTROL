alter table screenshot_events
  add column if not exists image_bytes bytea;

alter table screenshot_events
  alter column file_path drop not null;
