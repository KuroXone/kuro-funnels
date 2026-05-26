import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, total, pageSize = 20, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const pages = []
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i)

  return (
    <div className="flex items-center justify-between px-4 py-3"
      style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <span className="text-[11px] text-slate-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        {pages[0] > 1 && <span className="text-slate-500 text-xs px-1">…</span>}
        {pages.map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
              p === page
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >{p}</button>
        ))}
        {pages[pages.length - 1] < totalPages && <span className="text-slate-500 text-xs px-1">…</span>}
        <button
          onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
