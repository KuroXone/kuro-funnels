import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Server, Megaphone, Users, BarChart2,
  ListTodo, Settings, LogOut, Zap, FileText, Shield,
  Globe, Activity, TrendingUp,
} from 'lucide-react'
import useAuthStore from '../store/authStore'

const SECTIONS = [
  {
    label: 'Sending',
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'    },
      { to: '/campaigns',   icon: Megaphone,        label: 'Campaigns'    },
      { to: '/contacts',    icon: Users,             label: 'Contacts'     },
      { to: '/analytics',   icon: BarChart2,         label: 'Analytics'    },
      { to: '/queue',       icon: ListTodo,           label: 'Queue'        },
      { to: '/templates',   icon: FileText,           label: 'Templates'    },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/domains',     icon: Globe,      label: 'Domains'      },
      { to: '/smtp',        icon: Server,     label: 'SMTP Manager' },
      { to: '/smtp-health', icon: Activity,   label: 'SMTP Health'  },
      { to: '/warmup',      icon: TrendingUp, label: 'Warmup'       },
    ],
  },
]

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      className={({ isActive }) =>
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative group ' +
        (isActive
          ? 'text-blue-600'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')
      }
      style={({ isActive }) =>
        isActive
          ? { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)' }
          : { border: '1px solid transparent' }
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-blue-500" />
          )}
          <Icon
            size={15}
            style={{ color: isActive ? '#3B82F6' : undefined }}
            className={!isActive ? 'text-slate-400 group-hover:text-slate-500 transition-colors' : ''}
          />
          <span className="flex-1 leading-none">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { logout, user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  return (
    <aside
      className="w-[220px] min-h-screen flex flex-col fixed left-0 top-0 z-40 scrollbar-thin overflow-y-auto"
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' }}
          >
            <Zap size={14} className="text-white" />
          </div>
          <div className="leading-none">
            <p className="font-bold text-[13px] tracking-widest text-slate-800">KURO</p>
            <p className="text-[10px] font-semibold tracking-widest text-blue-500">FUNNELS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ to, icon, label }) => (
                <NavItem key={to} to={to} icon={icon} label={label} />
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Account
          </p>
          <div className="space-y-0.5">
            <NavItem to="/settings" icon={Settings} label="Settings" />
            {isAdmin && <NavItem to="/admin" icon={Shield} label="Admin" />}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
          >
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 text-[12px] font-medium truncate leading-none">{user?.username}</p>
            <p className="text-[10px] capitalize leading-none mt-0.5 text-slate-400">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-slate-400 hover:text-red-500 hover:bg-red-50"
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
