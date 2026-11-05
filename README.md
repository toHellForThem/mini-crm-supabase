# Mini-CRM «Объекты и задачи»

Небольшая CRM для строительной компании: постановщик ставит задачи по объектам, исполнители берут их в работу, отправляют на проверку, постановщик принимает или возвращает на доработку. Все переходы статусов и права доступа проверяются на уровне базы данных (PostgreSQL + RLS), а не только в интерфейсе.

## Стек

- React 18 + TypeScript + Vite
- Tailwind CSS
- TanStack Query (React Query)
- React Router
- Supabase (Auth, PostgreSQL, Row Level Security)

## Требования

- Node.js 18+
- Аккаунт Supabase (бесплатный тариф подходит)

## Запуск

### 1. Создайте проект в Supabase

1. Зайдите на [supabase.com](https://supabase.com) и создайте новый проект.
2. Дождитесь окончания инициализации базы.

### 2. Примените миграцию

**Вариант A — через SQL Editor (проще):**

1. Откройте в проекте Supabase: **SQL Editor → New query**.
2. Скопируйте содержимое файла [`supabase/migrations/20260101000000_init.sql`](supabase/migrations/20260101000000_init.sql) и нажмите **Run**.

**Вариант B — через Supabase CLI:**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Отключите открытую регистрацию

В Supabase откройте **Authentication → Providers → Email** и выключите **Allow new users to sign up**. Пользователи будут создаваться только вручную администратором.

### 4. Создайте пользователей

Откройте **Authentication → Users → Add user** и создайте минимум трёх пользователей:

| Email | Пароль | User Metadata (JSON) |
|---|---|---|
| manager@example.com | password123 | `{"role":"manager","full_name":"Иван Петров"}` |
| executor1@example.com | password123 | `{"role":"executor","full_name":"Алексей Смирнов"}` |
| executor2@example.com | password123 | `{"role":"executor","full_name":"Мария Кузнецова"}` |

Поле **User Metadata** соответствует `raw_user_meta_data`. Триггер `handle_new_user` автоматически создаст запись в `public.profiles`, взяв оттуда `role` и `full_name`. Если метаданные не указаны, роль по умолчанию — `executor`; её можно поправить вручную:

```sql
update public.profiles
set role = 'manager', full_name = 'Иван Петров'
where email = 'manager@example.com';
```

> Открытая регистрация отключена: пользователи создаются только вручную в Supabase.

### 5. (Необязательно) Заполните демо-данными

Выполните в SQL Editor файл [`supabase/seed.sql`](supabase/seed.sql). Скрипт найдёт первого менеджера и двух исполнителей, создаст 3 объекта и 5 задач в разных статусах с историей.

### 6. Настройте `.env`

```bash
cp .env.example .env
```

Заполните:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Оба значения лежат в Supabase: **Settings → API**.

> В репозиторий и во фронтенд попадает только `anon` (публичный) ключ. `service_role` и пароль базы **не используются** и не должны попадать в `.env` или в код.

### 7. Запустите приложение

```bash
npm install
npm run dev
```

Приложение откроется на `http://localhost:5173`.

### 8. Сборка

```bash
npm run build
npm run preview
```

## Деплой на Vercel

1. Импортируйте репозиторий в Vercel.
2. В **Settings → Environment Variables** добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Framework preset определится как Vite автоматически.

## Роли и доступ

- **Постановщик (manager)** — создаёт/редактирует/удаляет объекты и задачи, назначает исполнителя, принимает задачи и возвращает на доработку, видит все объекты и задачи.
- **Исполнитель (executor)** — видит только свои задачи и объекты, в которых у него есть задачи; берёт задачу в работу и отправляет на проверку.

## Статусы и переходы

| Из | В | Кто | Условие |
|---|---|---|---|
| — | Новая | постановщик | при создании |
| Новая | В работе | назначенный исполнитель | — |
| В работе | На проверке | назначенный исполнитель | — |
| На проверке | Принята | постановщик | — |
| На проверке | На доработке | постановщик | комментарий обязателен |
| На доработке | В работе | назначенный исполнитель | — |

Переходы реализованы в SQL-функции `update_task_status()`. Прямое изменение поля `status` через API блокируется триггером.

## Проверка безопасности (SQL-тесты)

В репозитории есть SQL-тесты, которые проверяют RLS и переходы статусов на обычном PostgreSQL (эмуляция Supabase через [`tests/sql/harness.sql`](tests/sql/harness.sql)):

```bash
docker rm -f crm-pg 2>/dev/null
docker run -d --name crm-pg -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:15-alpine
until docker exec crm-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec -i crm-pg psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/harness.sql
docker exec -i crm-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260101000000_init.sql
docker exec -i crm-pg psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/rls_test.sql
```

Ожидаемый результат: `ALL RLS AND TRANSITION TESTS PASSED`.

## Безопасность

Подробно описано в [`docs/explanation.md`](docs/explanation.md). Кратко:

- **RLS включён на всех таблицах.** Исполнитель не может прочитать или изменить чужую задачу даже через прямой запрос к Supabase.
- **Смена статуса — только через `security definer` RPC `update_task_status()`.** Функция проверяет роль, владельца задачи и допустимость перехода; запрещённый переход выбрасывает исключение.
- **Прямое изменение `status` запрещено триггером** `prevent_direct_status_change`.
- **История неизменяема:** `INSERT/UPDATE/DELETE` на `task_history` отозваны у ролей `authenticated` и `anon`; записи создаются только триггерами и RPC.
- **Новые задачи всегда создаются в статусе `new`** (триггер `force_new_task_status`).
- **Открытая регистрация отключена** — пользователи создаются вручную.

## Структура проекта

```
supabase/
  migrations/20260101000000_init.sql   # схема, RLS, триггеры, RPC
  seed.sql                             # демо-данные
src/
  components/                          # Layout, ProtectedRoute, StatusBadge
  contexts/AuthContext.tsx             # сессия и профиль
  hooks/                               # React Query хуки
  lib/                                 # supabase client, типы, утилиты
  pages/                               # экраны
docs/explanation.md                    # объяснение для руководителя
docs/decisions.md                      # решения и допущения
tests/sql/harness.sql                  # эмуляция Supabase для SQL-тестов
tests/sql/rls_test.sql                 # тесты RLS и переходов статусов
```
