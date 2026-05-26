export default function ReputationBar({ score = 100, showLabel = true }) {
  const pct = Math.max(0, Math.min(100, score))
  const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
  const label = pct >= 80 ? 'Excellent' : pct >= 50 ? 'Fair' : 'Poor'

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] text-slate-500">Reputation</span>
          <span className="text-[11px] font-semibold" style={{ color }}>{pct.toFixed(0)} — {label}</span>
        </div>
      )}
      <div className="w-full rounded-full h-1.5 overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
