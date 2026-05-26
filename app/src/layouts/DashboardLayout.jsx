import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-x-hidden page-enter" style={{ marginLeft: '220px' }}>
        <Outlet />
      </main>
    </div>
  )
}
