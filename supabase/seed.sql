-- Demo seed for Mini-CRM.
-- Run AFTER creating at least 1 manager and 2 executors in Supabase Auth.
-- Safe to run multiple times: it skips if objects already exist.

do $$
declare
  v_manager uuid;
  v_exec1 uuid;
  v_exec2 uuid;
  v_obj1 uuid;
  v_obj2 uuid;
  v_obj3 uuid;
  v_task1 uuid;
  v_task2 uuid;
  v_task3 uuid;
  v_task4 uuid;
  v_task5 uuid;
begin
  select id into v_manager from public.profiles where role = 'manager' order by created_at limit 1;
  select id into v_exec1 from public.profiles where role = 'executor' order by created_at limit 1;
  select id into v_exec2 from public.profiles where role = 'executor' order by created_at offset 1 limit 1;

  if v_manager is null or v_exec1 is null or v_exec2 is null then
    raise notice 'Need at least 1 manager and 2 executors. Create users first.';
    return;
  end if;

  if exists (select 1 from public.objects) then
    raise notice 'Objects already exist, skipping seed.';
    return;
  end if;

  insert into public.objects (name, address, created_by)
  values ('ЖК «Солнечный»', 'г. Москва, ул. Ленина, 10', v_manager)
  returning id into v_obj1;

  insert into public.objects (name, address, created_by)
  values ('БЦ «Горизонт»', 'г. Москва, пр-т Мира, 25', v_manager)
  returning id into v_obj2;

  insert into public.objects (name, address, created_by)
  values ('Складской комплекс', 'Московская обл., г. Химки, ул. Победы, 3', v_manager)
  returning id into v_obj3;

  -- Disable integrity triggers so we can seed tasks in different statuses.
  alter table public.tasks disable trigger force_new_task_status;
  alter table public.tasks disable trigger on_task_created;

  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values ('Залить фундамент', 'Бетон М300, арматура А500С', v_obj1, v_exec1, v_manager, 'new')
  returning id into v_task1;

  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values ('Возвести стены 1-го этажа', 'Кирпич керамический', v_obj1, v_exec2, v_manager, 'in_progress')
  returning id into v_task2;

  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values ('Монтаж окон', 'Пластиковые окна, 2 этаж', v_obj1, v_exec1, v_manager, 'review')
  returning id into v_task3;

  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values ('Установить лифты', '2 лифта, грузоподъёмность 1000 кг', v_obj2, v_exec2, v_manager, 'accepted')
  returning id into v_task4;

  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values ('Прокладка коммуникаций', 'Вода, электричество, канализация', v_obj3, v_exec1, v_manager, 'rework')
  returning id into v_task5;

  alter table public.tasks enable trigger force_new_task_status;
  alter table public.tasks enable trigger on_task_created;

  -- Plausible history for each task.
  insert into public.task_history (task_id, changed_by, from_status, to_status, comment) values
    (v_task1, v_manager, null, 'new', 'Задача создана'),
    (v_task2, v_manager, null, 'new', 'Задача создана'),
    (v_task2, v_exec2, 'new', 'in_progress', null),
    (v_task3, v_manager, null, 'new', 'Задача создана'),
    (v_task3, v_exec1, 'new', 'in_progress', null),
    (v_task3, v_exec1, 'in_progress', 'review', null),
    (v_task4, v_manager, null, 'new', 'Задача создана'),
    (v_task4, v_exec2, 'new', 'in_progress', null),
    (v_task4, v_exec2, 'in_progress', 'review', null),
    (v_task4, v_manager, 'review', 'accepted', null),
    (v_task5, v_manager, null, 'new', 'Задача создана'),
    (v_task5, v_exec1, 'new', 'in_progress', null),
    (v_task5, v_exec1, 'in_progress', 'review', null),
    (v_task5, v_manager, 'review', 'rework', 'Не хватает схемы прокладки. Добавьте.');
end $$;
