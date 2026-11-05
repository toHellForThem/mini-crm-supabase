import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTasks } from '@/hooks/useTasks'
import StatusBadge from '@/components/StatusBadge'

export default function MyTasksPage() {
  const { profile } = useAuth()
  const { data: tasks, isLoading } = useTasks({ assigneeId: profile?.id })

  if (isLoading) return <p className="text-gray-500">Загрузка...</p>

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Мои задачи</h1>
      {tasks?.length === 0 && <p className="text-gray-500">У вас пока нет задач.</p>}
      <div className="space-y-3">
        {tasks?.map((task) => (
          <Link
            key={task.id}
            to={`/tasks/${task.id}`}
            className="block rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-gray-900">{task.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{task.object?.name}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
