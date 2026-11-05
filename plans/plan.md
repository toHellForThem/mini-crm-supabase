# Mini-CRM «Объекты и задачи» — Implementation Plan

## 1. Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Deployment**: Vercel (config included)

## 2. Database Schema

### Tables
1. **profiles** (extends `auth.users`)
   - `id` uuid PK references auth.users
   - `email` text
   - `role` text check (role in ('manager', 'executor'))
   - `full_name` text

2. **objects**
   - `id` uuid PK default gen_random_uuid()
   - `name` text not null
   - `address` text not null
   - `created_at` timestamptz default now()
   - `created_by` uuid references profiles(id)

3. **tasks**
   - `id` uuid PK default gen_random_uuid()
   - `title` text not null
   - `description` text
   - `object_id` uuid references objects(id) on delete cascade
   - `assignee_id` uuid references profiles(id)
   - `status` text check (status in ('new', 'in_progress', 'review', 'accepted', 'rework'))
   - `author_id` uuid references profiles(id)
   - `created_at` timestamptz default now()

4. **task_history**
   - `id` uuid PK default gen_random_uuid()
   - `task_id` uuid references tasks(id) on delete cascade
   - `changed_by` uuid references profiles(id)
   - `changed_at` timestamptz default now()
   - `from_status` text
   - `to_status` text
   - `comment` text

## 3. Security (RLS & Triggers)

### RLS Policies
- **profiles**: Users can read their own profile. Managers can read all.
- **objects**:
  - Managers: ALL.
  - Executors: SELECT if they have a task in the object.
- **tasks**:
  - Managers: ALL.
  - Executors: SELECT if `assignee_id = auth.uid()`. UPDATE if `assignee_id = auth.uid()`.
- **task_history**:
  - Managers: SELECT all.
  - Executors: SELECT for their tasks.
  - INSERT/UPDATE/DELETE: Revoked from authenticated users. Only DB triggers/RPC can insert.

### Status Transition Logic (RPC)
Instead of direct `UPDATE` on `tasks`, we expose a `SECURITY DEFINER` RPC function:
`update_task_status(p_task_id uuid, p_new_status text, p_comment text default null)`

This function:
1. Verifies the current user's role and ownership.
2. Validates the transition:
   - `new` -> `in_progress` (executor, assignee)
   - `in_progress` -> `review` (executor, assignee)
   - `review` -> `accepted` (manager)
   - `review` -> `rework` (manager, comment required)
   - `rework` -> `in_progress` (executor, assignee)
3. Updates the task status.
4. Inserts a record into `task_history` with `auth.uid()`, old/new status, and comment.
5. Raises an exception on invalid transition.

This guarantees that even direct API calls cannot bypass the rules or forge history.

## 4. Frontend Architecture
- **Auth**: Supabase Auth (email/password). Login page.
- **Layout**: Sidebar with navigation (Objects, My Tasks, Logout).
- **Pages**:
  - `/login`
  - `/objects` (List)
  - `/objects/:id` (Detail with tasks)
  - `/tasks/:id` (Task detail with history and action buttons)
  - `/my-tasks` (Executor only)
- **Components**: TaskCard, StatusBadge, HistoryTimeline, ActionButtons.

## 5. Implementation Steps
1. Initialize Vite project and install dependencies.
2. Set up Supabase local dev (or provide SQL for cloud).
3. Write SQL migrations (schema, RLS, RPC).
4. Implement Supabase client and Auth context.
5. Build UI components and pages.
6. Integrate React Query for data fetching.
7. Write README and explanation docs.
8. Test RLS and transitions.
