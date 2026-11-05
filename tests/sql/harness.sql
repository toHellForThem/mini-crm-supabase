-- Test harness: emulates the Supabase environment in a plain PostgreSQL container.
-- DO NOT run this in a real Supabase project.

create role anon noinherit;
create role authenticated noinherit;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Emulate Supabase's auth.uid() using a session setting.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Emulate Supabase's default privileges for API roles.
-- The production migration then re-applies its own revokes for task_history
-- and for the status RPC.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;
