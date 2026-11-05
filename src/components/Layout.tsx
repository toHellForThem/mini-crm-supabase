import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, ClipboardList, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/objects', label: 'Объекты', icon: Building2, visible: true },
    {
      to: '/my-tasks',
      label: 'Мои задачи',
      icon: ClipboardList,
      visible: profile?.role === 'executor',
    },
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900">Mini-CRM</h1>
          <p className="mt-1 truncate text-sm text-gray-600">{profile?.full_name}</p>
          <p className="text-xs text-gray-400">
            {profile?.role === 'manager' ? 'Постановщик' : 'Исполнитель'}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems
            .filter((item) => item.visible)
            .map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname.startsWith(to)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
