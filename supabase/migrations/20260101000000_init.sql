-- ============================================================
-- Mini-CRM «Объекты и задачи» — initial schema, RLS and RPC
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- Mirrors auth.users with an application role.
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'executor')),
  full_name text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user is created in Supabase.
-- Role / name can be provided via user_metadata when creating the user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'executor'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: is the current user a manager?
-- SECURITY DEFINER avoids infinite recursion inside RLS policies
-- that would otherwise query public.profiles.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- ============================================================
-- 2. OBJECTS
-- ============================================================
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

-- ============================================================
-- 3. TASKS
-- ============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  object_id uuid not null references public.objects(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'review', 'accepted', 'rework')),
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index tasks_object_id_idx on public.tasks(object_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);

-- ============================================================
-- 4. TASK HISTORY
-- Append-only audit log. Write access is revoked from API roles;
-- only SECURITY DEFINER functions/triggers may insert.
-- ============================================================
create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now(),
  from_status text,
  to_status text not null,
  comment text
);

create index task_history_task_id_idx on public.task_history(task_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

-- ---------- profiles ----------
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Managers can view all profiles"
  on public.profiles for select
  using (public.is_manager());

create policy "Managers can update profiles"
  on public.profiles for update
  using (public.is_manager());

-- Allow participants of a shared task to see each other's names.
create policy "Users can view profiles of task participants"
  on public.profiles for select
  using (
    exists (
      select 1 from public.tasks t
      where (t.author_id = profiles.id or t.assignee_id = profiles.id)
        and (t.author_id = auth.uid() or t.assignee_id = auth.uid())
    )
  );

-- ---------- objects ----------
create policy "Managers can do everything with objects"
  on public.objects for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "Executors can view objects with their tasks"
  on public.objects for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.object_id = objects.id
        and tasks.assignee_id = auth.uid()
    )
  );

-- ---------- tasks ----------
create policy "Managers can do everything with tasks"
  on public.tasks for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "Executors can view own tasks"
  on public.tasks for select
  using (assignee_id = auth.uid());

-- NOTE: Executors intentionally have NO INSERT/UPDATE/DELETE policy.
-- Status changes go exclusively through public.update_task_status().

-- ---------- task_history ----------
create policy "Managers can view all history"
  on public.task_history for select
  using (public.is_manager());

create policy "Executors can view history of own tasks"
  on public.task_history for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_history.task_id
        and tasks.assignee_id = auth.uid()
    )
  );

-- History must be immutable through the API.
revoke insert, update, delete on public.task_history from authenticated;
revoke insert, update, delete on public.task_history from anon;

-- ============================================================
-- 6. TASK INTEGRITY TRIGGERS
-- ============================================================

-- New tasks must always start in status 'new'.
create or replace function public.force_new_task_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.status is distinct from 'new' then
    raise exception 'New tasks must have status = new';
  end if;
  return new;
end;
$$;

create trigger force_new_task_status
  before insert on public.tasks
  for each row execute procedure public.force_new_task_status();

-- Direct status updates are forbidden; only the RPC may change status.
create or replace function public.prevent_direct_status_change()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if current_setting('app.allow_status_change', true) is distinct from 'true' then
      raise exception 'Direct status change is not allowed. Use update_task_status() RPC.';
    end if;
  end if;
  return new;
end;
$$;

create trigger prevent_direct_status_change
  before update on public.tasks
  for each row execute procedure public.prevent_direct_status_change();

-- Log task creation (null -> new) into history.
create or replace function public.log_task_creation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.task_history (task_id, changed_by, from_status, to_status, comment)
  values (new.id, new.author_id, null, 'new', 'Задача создана');
  return new;
end;
$$;

create trigger on_task_created
  after insert on public.tasks
  for each row execute procedure public.log_task_creation();

-- ============================================================
-- 7. RPC: secure status transition + history logging
-- ============================================================
create or replace function public.update_task_status(
  p_task_id uuid,
  p_new_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_role text;
  v_allowed boolean := false;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'User profile not found';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if v_task.id is null then
    raise exception 'Task not found';
  end if;

  if v_role = 'executor' then
    if v_task.assignee_id <> auth.uid() then
      raise exception 'You are not assigned to this task';
    end if;

    if v_task.status = 'new' and p_new_status = 'in_progress' then
      v_allowed := true;
    elsif v_task.status = 'in_progress' and p_new_status = 'review' then
      v_allowed := true;
    elsif v_task.status = 'rework' and p_new_status = 'in_progress' then
      v_allowed := true;
    end if;

  elsif v_role = 'manager' then
    if v_task.status = 'review' and p_new_status = 'accepted' then
      v_allowed := true;
    elsif v_task.status = 'review' and p_new_status = 'rework' then
      if p_comment is null or btrim(p_comment) = '' then
        raise exception 'Comment is required when returning a task to rework';
      end if;
      v_allowed := true;
    end if;
  end if;

  if not v_allowed then
    raise exception 'Transition from % to % is not allowed for role %',
      v_task.status, p_new_status, v_role;
  end if;

  -- Allow the guarded update, then reset the flag.
  perform set_config('app.allow_status_change', 'true', true);

  update public.tasks
  set status = p_new_status
  where id = p_task_id;

  perform set_config('app.allow_status_change', 'false', true);

  insert into public.task_history (task_id, changed_by, from_status, to_status, comment)
  values (p_task_id, auth.uid(), v_task.status, p_new_status, nullif(btrim(p_comment), ''));
end;
$$;

-- Only authenticated users may call the status RPC.
revoke execute on function public.update_task_status(uuid, text, text) from anon, public;
grant execute on function public.update_task_status(uuid, text, text) to authenticated;
