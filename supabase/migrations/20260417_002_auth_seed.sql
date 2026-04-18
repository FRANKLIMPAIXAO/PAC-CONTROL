-- Add local auth password field for MVP dashboard login
alter table users add column if not exists password_hash text;

-- Helpful policies for manager/admin reads (you should harden this before production)
create policy if not exists "admin rh gestor can read users"
  on users for select
  to authenticated
  using (
    exists (
      select 1
      from users actor
      where actor.id = auth.uid()
        and actor.role in ('admin', 'rh', 'gestor')
    )
  );

create policy if not exists "admin rh gestor can read metrics daily"
  on metrics_daily for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (
      select 1
      from users actor
      where actor.id = auth.uid()
        and actor.role in ('admin', 'rh', 'gestor')
    )
  );
