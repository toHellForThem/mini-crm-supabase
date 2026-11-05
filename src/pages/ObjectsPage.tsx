import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useCreateObject,
  useDeleteObject,
  useObjects,
  useUpdateObject,
} from '@/hooks/useObjects'

export default function ObjectsPage() {
  const { profile } = useAuth()
  const { data: objects, isLoading, error } = useObjects()
  const createObject = useCreateObject()
  const updateObject = useUpdateObject()
  const deleteObject = useDeleteObject()

  const isManager = profile?.role === 'manager'

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    await createObject.mutateAsync({ name, address })
    setName('')
    setAddress('')
    setShowCreate(false)
  }

  function startEdit(object: { id: string; name: string; address: string }) {
    setEditingId(object.id)
    setEditName(object.name)
    setEditAddress(object.address)
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    await updateObject.mutateAsync({
      id: editingId,
      name: editName,
      address: editAddress,
    })
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить объект и все его задачи?')) return
    await deleteObject.mutateAsync(id)
  }

  if (isLoading) return <p className="text-gray-500">Загрузка...</p>
  if (error) return <p className="text-red-600">Ошибка загрузки объектов</p>

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Объекты</h1>
        {isManager && (
          <button
            onClick={() => setShowCreate((value) => !value)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Добавить объект
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          <input
            placeholder="Название объекта"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Адрес"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createObject.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Создать
          </button>
        </form>
      )}

      {objects?.length === 0 && <p className="text-gray-500">Объектов пока нет.</p>}

      <div className="grid gap-4">
        {objects?.map((object) => (
          <div
            key={object.id}
            className="rounded-xl border border-gray-200 bg-white transition-all hover:border-blue-300"
          >
            {editingId === object.id ? (
              <form onSubmit={handleEdit} className="space-y-3 p-5">
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updateObject.isPending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <X size={14} /> Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-4 p-5">
                <Link to={`/objects/${object.id}`} className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">{object.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <MapPin size={14} /> {object.address}
                  </p>
                </Link>
                {isManager && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(object)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Редактировать"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(object.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
