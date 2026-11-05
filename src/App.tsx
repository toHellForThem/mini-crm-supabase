import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LoginPage from '@/pages/LoginPage'
import ObjectsPage from '@/pages/ObjectsPage'
import ObjectDetailPage from '@/pages/ObjectDetailPage'
import TaskDetailPage from '@/pages/TaskDetailPage'
import MyTasksPage from '@/pages/MyTasksPage'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/objects" element={<ObjectsPage />} />
        <Route path="/objects/:id" element={<ObjectDetailPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/my-tasks" element={<MyTasksPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/objects" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
