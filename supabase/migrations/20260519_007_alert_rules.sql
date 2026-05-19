CREATE TABLE IF NOT EXISTS alert_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('idle_too_long', 'below_focus', 'unproductive_site', 'offline_too_long')),
  threshold   int NOT NULL DEFAULT 30,
  enabled     boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
