import { useState } from 'react'
import { Shield, UserCheck, UserX, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'
import { PageLoader } from '../components/LoadingSpinner'
import LoadingSpinner from '../components/LoadingSpinner'
import useApi from '../hooks/useApi'
import useDebounce from '../hooks/useDebounce'
import useAuthStore from '../store/authStore'
import { usersAPI } from '../services/api'

export default function AdminPanel() {
  const { user: me } = useAuthStore()
  const [search, setSearch] = useState('')
  const dSearch = useDebounce(search)
  const [togglingId, setTogglingId] = useState(null)

  const { data: users, loading, refetch } = useApi(
    () => usersAPI.list(),
    [],
  )

  const filtered = (users || []).filter((u) =>
    !dSearch || u.email.toLowerCase().includes(dSearch.toLowerCase()) || u.username.toLowerCase().includes(dSearch.toLowerCase())
  )

  const handleToggle = async (id) => {
    setTogglingId(id)
    try {
      await usersAPI.toggleUser(id)
      toast.success('User status updated')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally {
      setTogglingId(null)
    }
  }

  if (me?.role !== 'admin') {
    return (
      <div>
        <Header title="Admin Panel" />
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <Shield size={32} className="mx-auto text-red-400 mb-3" />
            <p className="text-red-400 font-semibold">Access Denied</p>
            <p className="text-slate-500 text-sm mt-1">You need admin privileges to view this page.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Admin Panel" />
      <div className="p-6 space-y-5">
        {/* Header stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: (users || []).length, color: 'text-violet-400' },
            { label: 'Active', value: (users || []).filter((u) => u.is_active).length, color: 'text-green-400' },
            { label: 'Admins', value: (users || []).filter((u) => u.role === 'admin').length, color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between">
          <h2 className="text-slate-800 font-semibold">All Users</h2>
          <SearchInput value={search} onChange={setSearch} placeholder="Search users..." className="w-56" />
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? <PageLoader /> : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No users found" />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['User', 'Email', 'Role', 'Status', 'Joined', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-slate-800 text-sm font-medium">{u.username}</p>
                          {u.full_name && <p className="text-slate-500 text-xs">{u.full_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-200 text-slate-500'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={u.is_active ? 'active' : 'paused'} label={u.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== me?.id && (
                        <button
                          onClick={() => handleToggle(u.id)}
                          disabled={togglingId === u.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            u.is_active
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          }`}
                        >
                          {togglingId === u.id ? (
                            <LoadingSpinner size="sm" />
                          ) : u.is_active ? (
                            <><UserX size={12} /> Deactivate</>
                          ) : (
                            <><UserCheck size={12} /> Activate</>
                          )}
                        </button>
                      )}
                      {u.id === me?.id && <span className="text-xs text-gray-600">You</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
