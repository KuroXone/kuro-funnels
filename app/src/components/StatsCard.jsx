import { TrendingUp, TrendingDown } from 'lucide-react'

const P = {
  blue:   { icon: '#3B82F6', ring: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.25)'  },
  purple: { icon: '#8B5CF6', ring: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.25)'  },
  violet: { icon: '#8B5CF6', ring: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.25)'  },
  green:  { icon: '#10B981', ring: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.25)'  },
  orange: { icon: '#F59E0B', ring: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.25)'  },
  red:    { icon: '#EF4444', ring: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.25)'   },
  cyan:   { icon: '#06B6D4', ring: 'rgba(6,182,212,0.18)',   border: 'rgba(6,182,212,0.25)'   },
  indigo: { icon: '#6366F1', ring: 'rgba(99,102,241,0.18)',  border: 'rgba(99,102,241,0.25)'  },
  slate:  { icon: '#94A3B8', ring: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.18)' },
}

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const c = P[color] || P.blue

  return (
    <div className="card card-hover p-5 cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: c.ring, border: `1px solid ${c.border}` }}
        >
          {Icon && <Icon size={16} style={{ color: c.icon }} />}
        </div>
        {trend !== undefined && (
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{
              color: trend >= 0 ? '#10B981' : '#EF4444',
              background: trend >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            }}
          >
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[22px] font-bold text-[#F8FAFC] leading-none tracking-tight mb-1">{value ?? '—'}</p>
      <p className="text-[13px] font-medium text-[#94A3B8] mt-1.5">{title}</p>
      {subtitle && <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>}
    </div>
  )
}
