-- Run after migrations to bootstrap one company/team/admin user
-- Replace UUID/email/senha to your values.

insert into companies (id, name, cnpj)
values ('11111111-1111-1111-1111-111111111111', 'Minha Empresa', null)
on conflict (id) do nothing;

insert into teams (id, company_id, name)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Administrativo')
on conflict (id) do nothing;

insert into users (id, company_id, team_id, name, email, role, status, password_hash)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Administrador',
  'admin@empresa.com',
  'admin',
  'active',
  crypt('TroqueEssaSenha123!', gen_salt('bf'))
)
on conflict (email) do update
set password_hash = excluded.password_hash,
    role = excluded.role,
    status = excluded.status;
