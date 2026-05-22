import { Bell, Search, Command } from 'lucide-react'
import useAuthStore from '../store/authStore'

export default function Header({ title, subtitle, action }) {
  const { user } = useAuthStore()

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-6 h-14"
      style={{
        background: 'rgba(11,16,32,0.85)',
        backdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Title area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-[#F8FAFC] leading-none truncate">{title}</h1>
          {subtitle && (
            <span
              className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#64748B',
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
        {/* Search hint */}
        <button
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg text-xs transition-all duration-150"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#4E637A',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#94A3B8' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#4E637A' }}
        >
          <Search size={12} />
          <span>Search</span>
          <span
            className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <Command size={9} />K
          </span>
        </button>

        {/* Notifications */}
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
        >
          <Bell size={14} className="text-[#64748B]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
        </button>

        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
          title={user?.username}
        >
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
