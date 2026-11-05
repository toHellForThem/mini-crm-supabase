# Mini-CRM «Объекты и задачи»

Небольшая CRM для строительной компании: постановщик ставит задачи по объектам, исполнители берут их в работу и отправляют на проверку. Права и переходы статусов проверяются на уровне PostgreSQL (RLS + RPC), а не только в интерфейсе.

## Демо

- **Приложение:** `<вставьте ссылку на Vercel>`
- **Постановщик:** `manager@example.com` / `password123`
- **Исполнитель 1:** `executor1@example.com` / `password123`
- **Исполнитель 2:** `executor2@example.com` / `password123`

## Стек

React 18 + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router, Supabase (Auth, PostgreSQL, RLS).

## Запуск

### 1. Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В **SQL Editor** выполните [`supabase/migrations/20260101000000_init.sql`](supabase/migrations/20260101000000_init.sql).
3. В **Authentication → Providers → Email** выключите **Allow new users to sign up**.
4. В **Authentication → Users → Add user** создайте трёх пользователей:

| Email | Пароль |
|---|---|
| manager@example.com | password123 |
| executor1@example.com | password123 |
| executor2@example.com | password123 |

5. В **SQL Editor** проставьте роли и имена:

```sql
update public.profiles set role = 'manager', full_name = 'Иван Петров' where email = 'manager@example.com';
update public.profiles set role = 'executor', full_name = 'Алексей Смирнов' where email = 'executor1@example.com';
update public.profiles set role = 'executor', full_name = 'Мария Кузнецова' where email = 'executor2@example.com';
```

6. (Необязательно) Выполните [`supabase/seed.sql`](supabase/seed.sql) — создаст 3 объекта, 5 задач и историю.

### 2. Локальный запуск

```bash
cp .env.example .env
# заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (Settings → API)
npm install
npm run dev -- --host 0.0.0.0
```

Откройте `http://localhost:5173`.

> Флаг `--host 0.0.0.0` нужен в WSL/Docker/на удалённой машине: без него Vite может привязаться только к IPv6 `::1`, и браузер не подключится.

### 3. Сборка

```bash
npm run build
npm run preview
```

## Деплой

Vercel или Netlify. В настройках проекта укажите:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Для Netlify уже есть [`netlify.toml`](netlify.toml) с SPA-редиректом.

## Роли и статусы

- **Постановщик** — создаёт/редактирует/удаляет объекты и задачи, назначает исполнителя, принимает и возвращает на доработку, видит всё.
- **Исполнитель** — видит только свои задачи и объекты с ними, берёт в работу и отправляет на проверку.

| Из | В | Кто | Условие |
|---|---|---|---|
| — | Новая | постановщик | при создании |
| Новая | В работе | исполнитель | — |
| В работе | На проверке | исполнитель | — |
| На проверке | Принята | постановщик | — |
| На проверке | На доработке | постановщик | комментарий обязателен |
| На доработке | В работе | исполнитель | — |

## Безопасность

- RLS на всех таблицах: исполнитель не видит чужие задачи даже через прямой API.
- Смена статуса — только через `update_task_status()`; прямой `UPDATE status` блокируется триггером.
- История статусов append-only: `INSERT/UPDATE/DELETE` отозваны у `authenticated` и `anon`.
- Открытая регистрация отключена.
- `service_role` не используется во фронтенде.

Подробнее: [`docs/explanation.md`](docs/explanation.md) и [`docs/decisions.md`](docs/decisions.md).

## Тесты

SQL-тесты RLS и переходов:

```bash
docker rm -f crm-pg 2>/dev/null
docker run -d --name crm-pg -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:15-alpine
until docker exec crm-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec -i crm-pg psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/harness.sql
docker exec -i crm-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260101000000_init.sql
docker exec -i crm-pg psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/rls_test.sql
```

Ожидаемый результат: `ALL RLS AND TRANSITION TESTS PASSED`.
