import { Bell, Search, Command, Settings, LogOut, User, X,
         LayoutDashboard, Megaphone, Users, BarChart2, ListTodo,
         FileText, Globe, Server, Activity, TrendingUp, Shield } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

/* ── all navigable pages for command palette ── */
const NAV_ITEMS = [
  { label: 'Dashboard',    to: '/dashboard',  icon: LayoutDashboard, group: 'Sending'        },
  { label: 'Campaigns',    to: '/campaigns',  icon: Megaphone,        group: 'Sending'        },
  { label: 'Contacts',     to: '/contacts',   icon: Users,            group: 'Sending'        },
  { label: 'Analytics',    to: '/analytics',  icon: BarChart2,        group: 'Sending'        },
  { label: 'Queue',        to: '/queue',      icon: ListTodo,         group: 'Sending'        },
  { label: 'Templates',    to: '/templates',  icon: FileText,         group: 'Sending'        },
  { label: 'Domains',      to: '/domains',    icon: Globe,            group: 'Infrastructure' },
  { label: 'SMTP Manager', to: '/smtp',       icon: Server,           group: 'Infrastructure' },
  { label: 'SMTP Health',  to: '/smtp-health',icon: Activity,         group: 'Infrastructure' },
  { label: 'Warmup',       to: '/warmup',     icon: TrendingUp,       group: 'Infrastructure' },
  { label: 'Settings',     to: '/settings',   icon: Settings,         group: 'Account'        },
  { label: 'Admin Panel',  to: '/admin',      icon: Shield,           group: 'Account'        },
]

/* ── Command Palette ─────────────────────────────────────────── */
function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const results = NAV_ITEMS.filter(item => {
    if (item.to === '/admin' && user?.role !== 'admin') return false
    return item.label.toLowerCase().includes(q.toLowerCase()) ||
           item.group.toLowerCase().includes(q.toLowerCase())
  })

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQ(''); setSelected(0) }
  }, [open])

  useEffect(() => { setSelected(0) }, [q])

  const go = useCallback((to) => { navigate(to); onClose() }, [navigate, onClose])

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')     { if (results[selected]) go(results[selected].to) }
    if (e.key === 'Escape')    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.10)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search pages…"
            className="flex-1 text-[14px] text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-400">ESC</kbd>
        </div>

        {/* results */}
        <div className="max-h-72 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="text-center py-8 text-[13px] text-slate-400">No results for "{q}"</p>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.to}
                  onClick={() => go(item.to)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${i === selected ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <Icon size={13} className={i === selected ? 'text-blue-600' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium leading-none ${i === selected ? 'text-blue-700' : 'text-slate-700'}`}>{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.group}</p>
                  </div>
                  {i === selected && <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 border border-blue-200 text-blue-500">↵</kbd>}
                </button>
              )
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
          <span><kbd className="px-1 rounded border border-slate-200 bg-slate-50">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 rounded border border-slate-200 bg-slate-50">↵</kbd> Open</span>
          <span><kbd className="px-1 rounded border border-slate-200 bg-slate-50">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}

/* ── Notifications Dropdown ──────────────────────────────────── */
function NotificationsDropdown({ onClose }) {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-lg overflow-hidden z-50"
      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.10)' }}
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-slate-800">Notifications</span>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={13} /></button>
      </div>
      <div className="py-10 text-center">
        <Bell size={24} className="mx-auto text-slate-200 mb-2" />
        <p className="text-[13px] font-medium text-slate-500">No notifications yet</p>
        <p className="text-[11px] text-slate-400 mt-1">Campaign results and alerts will appear here</p>
      </div>
    </div>
  )
}

/* ── User Menu Dropdown ──────────────────────────────────────── */
function UserMenuDropdown({ user, onClose }) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const go = (path) => { navigate(path); onClose() }
  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg overflow-hidden z-50"
      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.10)' }}
    >
      {/* User info */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
          >
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 truncate">{user?.username}</p>
            <p className="text-[11px] text-slate-400 truncate capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <button
          onClick={() => go('/settings')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <User size={13} className="text-slate-400" />
          Profile & Settings
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => go('/admin')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Shield size={13} className="text-slate-400" />
            Admin Panel
          </button>
        )}
      </div>

      <div className="border-t border-slate-100 py-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  )
}

/* ── Main Header ─────────────────────────────────────────────── */
export default function Header({ title, subtitle, action }) {
  const { user } = useAuthStore()
  const [searchOpen, setSearchOpen]     = useState(false)
  const [notifOpen,  setNotifOpen]      = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const notifRef   = useRef(null)
  const userRef    = useRef(null)

  /* ⌘K / Ctrl+K to open search */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setNotifOpen(false)
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))  setNotifOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target))   setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      <header
        className="sticky top-0 z-30 flex items-center gap-4 px-6 h-14"
        style={{
          background: 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(16px) saturate(180%)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {/* Title area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold text-slate-800 leading-none truncate">{title}</h1>
            {subtitle && (
              <span
                className="text-xs px-2 py-0.5 rounded-md font-medium"
                style={{
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#475569',
                }}
              >
                {subtitle}
              </span>
            )}
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Search button */}
          <button
            onClick={() => { setSearchOpen(true); setNotifOpen(false); setUserMenuOpen(false) }}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg text-xs transition-all duration-150 text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50"
            style={{ background: '#F8F9FC' }}
          >
            <Search size={12} />
            <span>Search</span>
            <span className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200 text-slate-500">
              <Command size={9} />K
            </span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(v => !v); setUserMenuOpen(false) }}
              className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 border ${notifOpen ? 'bg-blue-50 border-blue-200 text-blue-500' : 'text-slate-400 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}
              style={notifOpen ? {} : { background: '#F8F9FC' }}
            >
              <Bell size={14} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
            </button>
            {notifOpen && <NotificationsDropdown onClose={() => setNotifOpen(false)} />}
          </div>

          {/* User avatar */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => { setUserMenuOpen(v => !v); setNotifOpen(false) }}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 transition-all ring-2 ${userMenuOpen ? 'ring-blue-400 ring-offset-1' : 'ring-transparent hover:ring-blue-300 hover:ring-offset-1'}`}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
              title={user?.username}
            >
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </button>
            {userMenuOpen && <UserMenuDropdown user={user} onClose={() => setUserMenuOpen(false)} />}
          </div>

        </div>
      </header>

      {/* Command Palette (full-screen overlay) */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
