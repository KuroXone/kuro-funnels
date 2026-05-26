const V = {
  active:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',   dot: 'dot-active'  },
  sending:    { cls: 'bg-blue-50 text-blue-700 border-blue-200',             dot: 'dot-pending' },
  paused:     { cls: 'bg-amber-50 text-amber-700 border-amber-200',          dot: 'dot-warning' },
  draft:      { cls: 'bg-slate-100 text-slate-500 border-slate-200',         dot: ''            },
  scheduled:  { cls: 'bg-sky-50 text-sky-700 border-sky-200',               dot: 'dot-pending' },
  completed:  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',   dot: ''            },
  failed:     { cls: 'bg-red-50 text-red-600 border-red-200',                dot: 'dot-error'   },
  error:      { cls: 'bg-red-50 text-red-600 border-red-200',                dot: 'dot-error'   },
  pending:    { cls: 'bg-amber-50 text-amber-700 border-amber-200',          dot: 'dot-warning' },
  sent:       { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',   dot: ''            },
  retry:      { cls: 'bg-orange-50 text-orange-600 border-orange-200',       dot: ''            },
  testing:    { cls: 'bg-violet-50 text-violet-700 border-violet-200',       dot: 'dot-pending' },
  processing: { cls: 'bg-blue-50 text-blue-700 border-blue-200',             dot: 'dot-pending' },
  partial:    { cls: 'bg-amber-50 text-amber-700 border-amber-200',          dot: 'dot-warning' },
  suspended:  { cls: 'bg-red-50 text-red-600 border-red-200',                dot: 'dot-error'   },
}

const LABELS = {
  active: 'Active', sending: 'Sending', paused: 'Paused', draft: 'Draft',
  scheduled: 'Scheduled', completed: 'Completed', failed: 'Failed', error: 'Error',
  pending: 'Pending', sent: 'Sent', retry: 'Retry', testing: 'Testing',
  processing: 'Processing', partial: 'Partial', suspended: 'Suspended',
}

export default function Badge({ status, label, dot = true }) {
  const v = V[status] || { cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: '' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[11px] font-medium border leading-none ${v.cls}`}>
      {dot && v.dot
        ? <span className={v.dot} />
        : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
      }
      {label || LABELS[status] || status}
    </span>
  )
}
