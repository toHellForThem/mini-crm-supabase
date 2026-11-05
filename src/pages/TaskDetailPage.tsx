import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Building2,
  Clock,
  Pencil,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useDeleteTask,
  useTask,
  useUpdateTask,
  useUpdateTaskStatus,
} from '@/hooks/useTasks'
import { useTaskHistory } from '@/hooks/useTaskHistory'
import { useExecutors } from '@/hooks/useProfiles'
import StatusBadge from '@/components/StatusBadge'
import { STATUS_LABELS } from '@/lib/utils'
import type { TaskStatus } from '@/lib/types'

interface PendingAction {
  label: string
  next: TaskStatus
  requiresComment?: boolean
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const { data: task, isLoading } = useTask(id)
  const { data: history } = useTaskHistory(id)
  const updateStatus = useUpdateTaskStatus()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const isManager = profile?.role === 'manager'
  const { data: executors } = useExecutors(isManager)

  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssigneeId, setEditAssigneeId] = useState('')

  if (isLoading) return <p className="text-gray-500">Загрузка...</p>
  if (!task) return <p className="text-red-600">Задача не найдена</p>

  const isAssignee = task.assignee_id === profile?.id

  const actions: PendingAction[] = []
  if (isAssignee && task.status === 'new') {
    actions.push({ label: 'Взять в работу', next: 'in_progress' })
  }
  if (isAssignee && task.status === 'in_progress') {
    actions.push({ label: 'Отправить на проверку', next: 'review' })
  }
  if (isAssignee && task.status === 'rework') {
    actions.push({ label: 'Взять в работу', next: 'in_progress' })
  }
  if (isManager && task.status === 'review') {
    actions.push({ label: 'Принять', next: 'accepted' })
    actions.push({
      label: 'Вернуть на доработку',
      next: 'rework',
      requiresComment: true,
    })
  }

  const needsCommentField = actions.some((action) => action.requiresComment)

  async function handleAction(next: TaskStatus, requiresComment?: boolean) {
    setActionError(null)

    if (requiresComment && !comment.trim()) {
      setActionError('Комментарий обязателен при возврате на доработку')
      return
    }

    try {
      await updateStatus.mutateAsync({
        taskId: task!.id,
        newStatus: next,
        comment: comment.trim() || undefined,
      })
      setComment('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка смены статуса'
      setActionError(message)
    }
  }

  function startEdit() {
    if (!task) return
    setIsEditing(true)
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditAssigneeId(task.assignee_id)
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!task) return
    await updateTask.mutateAsync({
      id: task.id,
      title: editTitle,
      description: editDescription,
      assignee_id: editAssigneeId,
    })
    setIsEditing(false)
  }

  async function handleDelete() {
    if (!task) return
    if (!window.confirm('Удалить задачу?')) return
    const objectId = task.object_id
    await deleteTask.mutateAsync(task.id)
    navigate(`/objects/${objectId}`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={`/objects/${task.object_id}`}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Назад к объекту
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              required
              value={editAssigneeId}
              onChange={(e) => setEditAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {executors?.map((executor) => (
                <option key={executor.id} value={executor.id}>
                  {executor.full_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateTask.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <X size={14} /> Отмена
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={task.status} />
                {isManager && (
                  <>
                    <button
                      onClick={startEdit}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Редактировать"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={handleDelete}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {task.description && (
              <p className="mb-4 whitespace-pre-wrap text-gray-700">{task.description}</p>
            )}

            <div className="grid gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600 sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <Building2 size={15} /> {task.object?.name ?? '—'}
              </p>
              <p className="flex items-center gap-2">
                <User size={15} /> Исполнитель: {task.assignee?.full_name ?? '—'}
              </p>
              <p className="flex items-center gap-2">
                <User size={15} /> Автор: {task.author?.full_name ?? '—'}
              </p>
              <p className="flex items-center gap-2">
                <Clock size={15} /> {format(new Date(task.created_at), 'dd.MM.yyyy HH:mm')}
              </p>
            </div>
          </>
        )}
      </div>

      {actions.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 font-semibold">Действия</h2>
          {needsCommentField && (
            <textarea
              placeholder="Комментарий (обязателен для возврата на доработку)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <button
                key={action.label}
                disabled={updateStatus.isPending}
                onClick={() => handleAction(action.next, action.requiresComment)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  action.next === 'rework'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">История</h2>
        {!history?.length && <p className="text-sm text-gray-500">Истории пока нет.</p>}
        <ol className="relative ml-2 space-y-5 border-l border-gray-200">
          {history?.map((entry) => (
            <li key={entry.id} className="ml-5">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
              <p className="text-sm font-medium text-gray-900">
                {entry.from_status
                  ? `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`
                  : `Создана (${STATUS_LABELS[entry.to_status]})`}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {entry.changed_by_profile?.full_name ?? '—'} ·{' '}
                {format(new Date(entry.changed_at), 'dd.MM.yyyy HH:mm')}
              </p>
              {entry.comment && (
                <p className="mt-1 rounded-lg bg-gray-50 p-2 text-sm text-gray-700">
                  {entry.comment}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
