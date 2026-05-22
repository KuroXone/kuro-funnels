import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import useAuthStore from './store/authStore'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SMTPManager from './pages/SMTPManager'
import SMTPHealth from './pages/SMTPHealth'
import Campaigns from './pages/Campaigns'
import Contacts from './pages/Contacts'
import Analytics from './pages/Analytics'
import QueueMonitor from './pages/QueueMonitor'
import Settings from './pages/Settings'
import Templates from './pages/Templates'
import AdminPanel from './pages/AdminPanel'
import DomainManager from './pages/DomainManager'
import WarmupDashboard from './pages/WarmupDashboard'
import NotFound from './pages/NotFound'

import DashboardLayout from './layouts/DashboardLayout'
import LoadingSpinner from './components/LoadingSpinner'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1020' }}>
      <LoadingSpinner size="lg" />
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1020' }}>
      <LoadingSpinner size="lg" />
    </div>
  )
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  const { init } = useAuthStore()

  useEffect(() => { init() }, [])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1B2A42', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '14px' },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="smtp" element={<SMTPManager />} />
          <Route path="smtp-health" element={<SMTPHealth />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="queue" element={<QueueMonitor />} />
          <Route path="templates" element={<Templates />} />
          <Route path="domains" element={<DomainManager />} />
          <Route path="warmup" element={<WarmupDashboard />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
