export type Role = 'manager' | 'executor'

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'rework'

export interface Profile {
  id: string
  email: string
  role: Role
  full_name: string
  created_at: string
}

export interface ObjectItem {
  id: string
  name: string
  address: string
  created_at: string
  created_by: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  object_id: string
  assignee_id: string
  status: TaskStatus
  author_id: string
  created_at: string
  assignee?: Pick<Profile, 'id' | 'full_name'>
  author?: Pick<Profile, 'id' | 'full_name'>
  object?: Pick<ObjectItem, 'id' | 'name'>
}

export interface TaskHistory {
  id: string
  task_id: string
  changed_by: string
  changed_at: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  changed_by_profile?: Pick<Profile, 'id' | 'full_name'>
}
