-- Tabela de gravacoes de tela curtas (clips MP4)
CREATE TABLE IF NOT EXISTS video_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid        NOT NULL REFERENCES devices(id)  ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  ts          timestamptz NOT NULL,
  app_name    text,
  url_domain  text,
  is_idle     boolean     NOT NULL DEFAULT false,
  mime_type   text        NOT NULL DEFAULT 'video/mp4',
  file_path   text,
  sha256      text        NOT NULL,
  size_bytes  integer     NOT NULL,
  width       integer,
  height      integer,
  duration_sec integer,
  fps         integer,
  video_bytes bytea,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_events_user_ts   ON video_events (user_id,   ts DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_device_ts ON video_events (device_id, ts DESC);
