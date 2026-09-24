import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

/**
 * Central role guard for the router.
 *  role="student" — guests → /login, teachers → /teacher
 *  role="teacher" — guests → /login, students → /dashboard
 */
export default function ProtectedRoute({ role, children }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (role === 'teacher' && user.role !== 'teacher') return <Navigate to="/dashboard" replace />
  if (role === 'student' && user.role === 'teacher') return <Navigate to="/teacher" replace />
  return children
}

/** Already-authed users skip the login/register screens. */
export function GuestOnly({ children }) {
  const { user } = useApp()
  if (user) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/dashboard'} replace />
  return children
}
