import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useObject } from '@/hooks/useObjects'
import { useCreateTask, useDeleteTask, useTasks } from '@/hooks/useTasks'
import { useExecutors } from '@/hooks/useProfiles'
import StatusBadge from '@/components/StatusBadge'

export default function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { data: object, isLoading: objectLoading } = useObject(id)
  const { data: tasks, isLoading: tasksLoading } = useTasks({ objectId: id })

  const isManager = profile?.role === 'manager'
  const { data: executors } = useExecutors(isManager)
  const createTask = useCreateTask()
  const deleteTask = useDeleteTask()

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    await createTask.mutateAsync({
      title,
      description,
      object_id: id,
      assignee_id: assigneeId,
    })
    setTitle('')
    setDescription('')
    setAssigneeId('')
    setShowForm(false)
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm('Удалить задачу?')) return
    await deleteTask.mutateAsync(taskId)
  }

  if (objectLoading || tasksLoading) return <p className="text-gray-500">Загрузка...</p>
  if (!object) return <p className="text-red-600">Объект не найден</p>

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/objects"
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Назад к объектам
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{object.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin size={14} /> {object.address}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm((value) => !value)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Добавить задачу
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          <input
            placeholder="Название задачи"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            required
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Выберите исполнителя</option>
            {executors?.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createTask.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Создать
          </button>
        </form>
      )}

      {tasks?.length === 0 && <p className="text-gray-500">Задач по этому объекту пока нет.</p>}

      <div className="space-y-3">
        {tasks?.map((task) => (
          <div
            key={task.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300"
          >
            <Link to={`/tasks/${task.id}`} className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900">{task.title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                Исполнитель: {task.assignee?.full_name ?? '—'}
              </p>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={task.status} />
              {isManager && (
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Удалить задачу"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
