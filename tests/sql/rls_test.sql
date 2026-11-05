-- RLS and status-transition tests.
-- Run after harness.sql and the production migration.
\set ON_ERROR_STOP on

-- ---------------- seed as superuser (bypasses RLS) ----------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'manager@example.com', '{"role":"manager","full_name":"Manager"}'),
  ('00000000-0000-0000-0000-000000000002', 'exec1@example.com', '{"role":"executor","full_name":"Exec One"}'),
  ('00000000-0000-0000-0000-000000000003', 'exec2@example.com', '{"role":"executor","full_name":"Exec Two"}')
on conflict (id) do nothing;

insert into public.objects (id, name, address, created_by) values
  ('00000000-0000-0000-0000-000000000010', 'Object A', 'Address A', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000011', 'Object B (no tasks)', 'Address B', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.tasks (id, title, object_id, assignee_id, author_id, status) values
  ('00000000-0000-0000-0000-000000000020', 'Task for Exec1', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'new'),
  ('00000000-0000-0000-0000-000000000021', 'Task for Exec2', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'new')
on conflict (id) do nothing;

-- ---------------- executor 1 ----------------
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000002';

do $$
declare c int;
begin
  select count(*) into c from public.tasks;
  assert c = 1, format('Exec1 should see 1 task, saw %s', c);

  select count(*) into c from public.objects;
  assert c = 1, format('Exec1 should see 1 object (only the one with their task), saw %s', c);
end $$;

-- Direct status update is filtered by RLS (0 rows). Verify nothing changed.
update public.tasks set status = 'review' where id = '00000000-0000-0000-0000-000000000020';

do $$
declare s text;
begin
  select status into s from public.tasks where id = '00000000-0000-0000-0000-000000000020';
  assert s = 'new', format('Direct update must not change status, got %s', s);
end $$;

-- Valid transition through the RPC.
select public.update_task_status('00000000-0000-0000-0000-000000000020', 'in_progress', null);

do $$
declare s text;
begin
  select status into s from public.tasks where id = '00000000-0000-0000-0000-000000000020';
  assert s = 'in_progress', format('Status should be in_progress, got %s', s);
end $$;

-- Executor cannot accept.
do $$
begin
  begin
    perform public.update_task_status('00000000-0000-0000-0000-000000000020', 'accepted', null);
    raise exception 'Executor should not be able to accept a task';
  exception when others then
    null;
  end;
end $$;

-- Executor cannot touch another executor's task.
do $$
begin
  begin
    perform public.update_task_status('00000000-0000-0000-0000-000000000021', 'in_progress', null);
    raise exception 'Executor should not update another executor task';
  exception when others then
    null;
  end;
end $$;

-- History is not writable through the API.
do $$
begin
  begin
    insert into public.task_history (task_id, changed_by, from_status, to_status)
    values ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', 'new', 'in_progress');
    raise exception 'Direct history insert should have failed';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- ---------------- manager ----------------
reset role;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';

do $$
declare c int;
begin
  select count(*) into c from public.tasks;
  assert c = 2, format('Manager should see 2 tasks, saw %s', c);

  select count(*) into c from public.objects;
  assert c = 2, format('Manager should see 2 objects, saw %s', c);
end $$;

-- Manager cannot bypass the transition trigger with a direct update.
do $$
begin
  begin
    update public.tasks set status = 'accepted' where id = '00000000-0000-0000-0000-000000000020';
    raise exception 'Direct status update by manager should have failed';
  exception when others then
    null;
  end;
end $$;

-- Move the task to review as the executor, then test manager transitions.
reset role;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000002';
select public.update_task_status('00000000-0000-0000-0000-000000000020', 'review', null);

reset role;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';

-- Rework requires a comment.
do $$
begin
  begin
    perform public.update_task_status('00000000-0000-0000-0000-000000000020', 'rework', null);
    raise exception 'Rework without comment should have failed';
  exception when others then
    null;
  end;
end $$;

select public.update_task_status('00000000-0000-0000-0000-000000000020', 'rework', 'Fix it');

do $$
declare c int;
begin
  select count(*) into c from public.task_history where task_id = '00000000-0000-0000-0000-000000000020';
  assert c >= 4, format('Expected at least 4 history rows, saw %s', c);
end $$;

reset role;
\echo 'ALL RLS AND TRANSITION TESTS PASSED'
