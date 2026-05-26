import { useState } from 'react'
import { User, Lock, Shield, Bell, Settings as SettingsIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import useAuthStore from '../store/authStore'
import { usersAPI } from '../services/api'

export default function Settings() {
  const { user } = useAuthStore()
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || '', username: user?.username || '' })
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [tab, setTab] = useState('profile')

  const saveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await usersAPI.updateProfile(profileForm)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (passForm.next !== passForm.confirm) return toast.error('Passwords do not match')
    if (passForm.next.length < 8) return toast.error('Password must be at least 8 characters')
    setSavingPass(true)
    try {
      await usersAPI.changePassword(passForm.current, passForm.next)
      toast.success('Password changed')
      setPassForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Change failed')
    } finally {
      setSavingPass(false)
    }
  }

  const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={saveProfile} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-slate-800 font-semibold mb-2">Profile Information</h2>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center text-white text-xl font-bold">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-slate-800 font-medium">{user?.username}</p>
                <p className="text-slate-500 text-sm">{user?.email}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${user?.role === 'admin' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-200 text-slate-500'}`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
              <input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} placeholder="Jane Doe" className="w-full input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
              <input value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} className="w-full input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input value={user?.email} disabled className="w-full bg-slate-100/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 text-sm cursor-not-allowed" />
              <p className="text-xs text-gray-600 mt-1">Email cannot be changed</p>
            </div>
            <button type="submit" disabled={savingProfile} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
              {savingProfile && <LoadingSpinner size="sm" />}
              Save Profile
            </button>
          </form>
        )}

        {tab === 'security' && (
          <form onSubmit={savePassword} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-slate-800 font-semibold mb-2">Change Password</h2>
            {[['Current Password', 'current', 'Current password'], ['New Password', 'next', 'Min 8 characters'], ['Confirm Password', 'confirm', 'Confirm new password']].map(([label, key, placeholder]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                <input type="password" value={passForm[key]} onChange={(e) => setPassForm({ ...passForm, [key]: e.target.value })} required placeholder={placeholder} className="w-full input-base" />
              </div>
            ))}
            <button type="submit" disabled={savingPass} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
              {savingPass && <LoadingSpinner size="sm" />}
              Change Password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
