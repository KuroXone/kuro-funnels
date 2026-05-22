const V = {
  active:     { cls: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',  dot: 'dot-active'  },
  sending:    { cls: 'bg-blue-500/12 text-blue-400 border-blue-500/25',           dot: 'dot-pending' },
  paused:     { cls: 'bg-amber-500/12 text-amber-400 border-amber-500/25',        dot: 'dot-warning' },
  draft:      { cls: 'bg-white/6 text-[#64748B] border-white/10',                dot: ''            },
  scheduled:  { cls: 'bg-sky-500/12 text-sky-400 border-sky-500/25',             dot: 'dot-pending' },
  completed:  { cls: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25', dot: ''            },
  failed:     { cls: 'bg-red-500/12 text-red-400 border-red-500/25',             dot: 'dot-error'   },
  error:      { cls: 'bg-red-500/12 text-red-400 border-red-500/25',             dot: 'dot-error'   },
  pending:    { cls: 'bg-amber-500/12 text-amber-400 border-amber-500/25',       dot: 'dot-warning' },
  sent:       { cls: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25', dot: ''            },
  retry:      { cls: 'bg-orange-500/12 text-orange-400 border-orange-500/25',    dot: ''            },
  testing:    { cls: 'bg-violet-500/12 text-violet-400 border-violet-500/25',    dot: 'dot-pending' },
  processing: { cls: 'bg-blue-500/12 text-blue-400 border-blue-500/25',          dot: 'dot-pending' },
  partial:    { cls: 'bg-amber-500/12 text-amber-400 border-amber-500/25',       dot: 'dot-warning' },
  suspended:  { cls: 'bg-red-500/12 text-red-400 border-red-500/25',             dot: 'dot-error'   },
}

const LABELS = {
  active: 'Active', sending: 'Sending', paused: 'Paused', draft: 'Draft',
  scheduled: 'Scheduled', completed: 'Completed', failed: 'Failed', error: 'Error',
  pending: 'Pending', sent: 'Sent', retry: 'Retry', testing: 'Testing',
  processing: 'Processing', partial: 'Partial', suspended: 'Suspended',
}

export default function Badge({ status, label, dot = true }) {
  const v = V[status] || { cls: 'bg-white/6 text-[#64748B] border-white/10', dot: '' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[11px] font-medium border leading-none ${v.cls}`}>
      {dot && v.dot
        ? <span className={v.dot} />
        : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />
      }
      {label || LABELS[status] || status}
    </span>
  )
}
