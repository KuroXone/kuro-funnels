import { useEffect, useState } from 'react'
import { Zap, TrendingUp, CheckCircle, ChevronRight, Play, Pause, SkipForward } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import LoadingSpinner from '../components/LoadingSpinner'
import { warmupAPI, domainsAPI } from '../services/api'

const SCHEDULE_COLORS = [
  'bg-violet-500', 'bg-violet-500', 'bg-blue-500', 'bg-blue-500',
  'bg-cyan-500', 'bg-cyan-500', 'bg-teal-500', 'bg-teal-500',
  'bg-green-500', 'bg-green-500', 'bg-green-400', 'bg-green-400',
  'bg-emerald-500', 'bg-emerald-500',
]

function WarmupCard({ item, onToggle, onAdvance, toggling, advancing }) {
  const isComplete = item.pct_complete >= 100
  const sentPct = item.daily_limit > 0 ? Math.min(100, (item.sent_today / item.daily_limit) * 100) : 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-orange-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={17} className="text-orange-400" />
          </div>
          <div>
            <p className="text-slate-800 font-semibold">{item.domain}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              {isComplete ? 'Warmup complete ✓' : item.warmup_enabled ? `Day ${item.current_day} of ${item.schedule.length}` : 'Not started'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isComplete && (
            <button
              onClick={() => onAdvance(item.domain_id)}
              disabled={advancing}
              className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
              title="Manually advance one day"
            >
              {advancing ? <LoadingSpinner size="sm" /> : <SkipForward size={14} />}
            </button>
          )}
          <button
            onClick={() => onToggle(item.domain_id, item.warmup_enabled)}
            disabled={toggling || isComplete}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${item.warmup_enabled ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'} disabled:opacity-40`}
          >
            {toggling ? <LoadingSpinner size="sm" /> : item.warmup_enabled ? <Pause size={11} /> : <Play size={11} />}
            {item.warmup_enabled ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Warmup progress</span>
          <span>{item.pct_complete}% complete</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${isComplete ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${item.pct_complete}%` }}
          />
        </div>
      </div>

      {/* Today's usage */}
      {item.warmup_enabled && !isComplete && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Today's sends</span>
            <span>{item.sent_today} / {item.daily_limit?.toLocaleString()}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-500 bg-violet-500"
              style={{ width: `${sentPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Schedule mini chart */}
      <div>
        <p className="text-xs text-gray-600 mb-2">14-day schedule</p>
        <div className="flex items-end gap-0.5 h-10">
          {item.schedule.map((slot, i) => {
            const maxLimit = item.schedule[item.schedule.length - 1]?.limit || 10000
            const h = Math.max(8, (slot.limit / maxLimit) * 40)
            const isPast = i < item.current_day
            const isCurrent = i === item.current_day - 1
            return (
              <div
                key={slot.day}
                title={`Day ${slot.day}: ${slot.limit.toLocaleString()} emails`}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: `${h}px`,
                  backgroundColor: isPast ? '#22c55e' : isCurrent ? '#f97316' : '#e2e8f0',
                  border: isCurrent ? '1px solid #f97316' : 'none',
                }}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-700 mt-1">
          <span>Day 1</span>
          <span>Day 14</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
        <div className="text-center">
          <p className="text-sm font-bold text-orange-400">{item.daily_limit?.toLocaleString() || '—'}</p>
          <p className="text-xs text-gray-600">Daily limit</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-violet-400">{item.current_day || 0}</p>
          <p className="text-xs text-gray-600">Current day</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-500">{14 - (item.current_day || 0)}</p>
          <p className="text-xs text-gray-600">Days left</p>
        </div>
      </div>
    </div>
  )
}

export default function WarmupDashboard() {
  const [warmupData, setWarmupData] = useState([])
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const [advancingId, setAdvancingId] = useState(null)

  useEffect(() => {
    load()
    loadSchedule()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await warmupAPI.list()
      setWarmupData(Array.isArray(data) ? data : [])
    } catch { setWarmupData([]) }
    finally { setLoading(false) }
  }

  const loadSchedule = async () => {
    try {
      const { data } = await warmupAPI.schedule()
      setSchedule(data.schedule || [])
    } catch { setSchedule([]) }
  }

  const handleToggle = async (id, enabled) => {
    setTogglingId(id)
    try {
      if (enabled) {
        await warmupAPI.disable(id)
        toast.success('Warmup paused')
      } else {
        await warmupAPI.enable(id)
        toast.success('Warmup started')
      }
      load()
    } catch { toast.error('Failed') }
    finally { setTogglingId(null) }
  }

  const handleAdvance = async (id) => {
    setAdvancingId(id)
    try {
      const { data } = await warmupAPI.advance(id)
      toast.success(data.message)
      load()
    } catch { toast.error('Failed to advance') }
    finally { setAdvancingId(null) }
  }

  const active = warmupData.filter((d) => d.warmup_enabled)
  const complete = warmupData.filter((d) => d.pct_complete >= 100)

  return (
    <div>
      <Header title="Warmup Dashboard" />
      <div className="p-6 space-y-5">

        {/* Summary */}
        {warmupData.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Domains', value: warmupData.length, color: 'text-slate-700' },
              { label: 'Actively Warming', value: active.length, color: 'text-orange-400' },
              { label: 'Warmup Complete', value: complete.length, color: 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warmup schedule reference */}
        {schedule.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-slate-800 font-semibold mb-4">Standard Warmup Schedule</h3>
            <div className="grid grid-cols-7 gap-2">
              {schedule.map((slot) => (
                <div key={slot.day} className="text-center">
                  <div className={`text-xs font-bold px-2 py-1.5 rounded-lg mb-1 ${SCHEDULE_COLORS[slot.day - 1] || 'bg-green-500'} text-white`}>
                    {slot.limit >= 1000 ? `${slot.limit / 1000}k` : slot.limit}
                  </div>
                  <p className="text-xs text-gray-600">D{slot.day}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Domain cards */}
        {loading ? <PageLoader /> : warmupData.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No domains configured"
            description="Add a domain in the Domain Manager to start the warmup process."
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {warmupData.map((item) => (
              <WarmupCard
                key={item.domain_id}
                item={item}
                onToggle={handleToggle}
                onAdvance={handleAdvance}
                toggling={togglingId === item.domain_id}
                advancing={advancingId === item.domain_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
