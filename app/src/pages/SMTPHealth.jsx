import { useEffect, useState } from 'react'
import { RefreshCw, Activity, CheckCircle, XCircle, Clock, AlertTriangle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import ReputationBar from '../components/ReputationBar'
import EmptyState from '../components/EmptyState'
import { PageLoader } from '../components/LoadingSpinner'
import LoadingSpinner from '../components/LoadingSpinner'
import { smtpHealthAPI } from '../services/api'

function UsageBar({ pct, color = 'bg-violet-500' }) {
  const safeP = Math.min(100, pct || 0)
  const barColor = safeP > 90 ? 'bg-red-500' : safeP > 70 ? 'bg-yellow-500' : color
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${safeP}%` }} />
    </div>
  )
}

function StatusDot({ status }) {
  const colors = { active: 'bg-green-400', paused: 'bg-yellow-400', error: 'bg-red-400', testing: 'bg-blue-400' }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-slate-400'} ${status === 'active' ? 'animate-pulse' : ''}`} />
}

export default function SMTPHealth() {
  const [stats, setStats] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [reCalcId, setReCalcId] = useState(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [healthRes, summaryRes] = await Promise.all([
        smtpHealthAPI.all(),
        smtpHealthAPI.summary(),
      ])
      setStats(Array.isArray(healthRes.data) ? healthRes.data : [])
      setSummary(summaryRes.data)
    } catch {
      // silent refresh failures
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRecalc = async (id) => {
    setReCalcId(id)
    try {
      const { data } = await smtpHealthAPI.recalculate(id)
      toast.success(`Reputation recalculated: ${data.reputation_score}`)
      load()
    } catch { toast.error('Recalculation failed') }
    finally { setReCalcId(null) }
  }

  const s = summary || {}

  return (
    <div>
      <Header
        title="SMTP Health Monitor"
        action={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />
      <div className="p-6 space-y-5">

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Total SMTPs', value: s.total ?? 0, color: 'text-slate-700' },
              { label: 'Active', value: s.active ?? 0, color: 'text-green-400' },
              { label: 'Error', value: s.error ?? 0, color: 'text-red-400' },
              { label: 'Paused', value: s.paused ?? 0, color: 'text-yellow-400' },
              { label: 'Avg Reputation', value: `${s.avg_reputation ?? 0}%`, color: s.avg_reputation >= 80 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Avg Success Rate', value: `${s.avg_success_rate ?? 0}%`, color: s.avg_success_rate >= 95 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Sent 24h', value: (s.total_sent_24h ?? 0).toLocaleString(), color: 'text-violet-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-gray-600 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">Auto-refreshes every 15 seconds</span>
        </div>

        {/* SMTP cards */}
        {loading ? <PageLoader /> : stats.length === 0 ? (
          <EmptyState icon={Activity} title="No SMTP servers" description="Add SMTP servers in the SMTP Manager to see health stats here." />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.id} className={`bg-white border rounded-xl p-5 transition-all ${s.status === 'error' ? 'border-red-500/30' : s.status === 'active' ? 'border-slate-200 hover:border-slate-200' : 'border-yellow-500/20'}`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <StatusDot status={s.status} />
                    </div>
                    <div>
                      <p className="text-slate-800 font-semibold">{s.name}</p>
                      <p className="text-slate-500 text-xs">{s.host}:{s.port} {s.provider ? `· ${s.provider}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.is_cooldown && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                        <Clock size={10} /> Cooldown
                      </span>
                    )}
                    <button
                      onClick={() => handleRecalc(s.id)}
                      disabled={reCalcId === s.id}
                      className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                      title="Recalculate reputation"
                    >
                      {reCalcId === s.id ? <LoadingSpinner size="sm" /> : <RefreshCw size={12} />}
                    </button>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Sent (1h)', value: s.sent_last_hour?.toLocaleString(), icon: Zap, color: 'text-violet-400' },
                    { label: 'Sent (24h)', value: s.sent_last_24h?.toLocaleString(), icon: Activity, color: 'text-blue-400' },
                    { label: 'Success Rate', value: `${s.success_rate}%`, icon: CheckCircle, color: s.success_rate >= 95 ? 'text-green-400' : 'text-yellow-400' },
                    { label: 'Bounce Rate', value: `${s.bounce_rate}%`, icon: XCircle, color: s.bounce_rate > 5 ? 'text-red-400' : 'text-green-400' },
                    { label: 'Reputation', value: `${s.reputation_score}%`, icon: Activity, color: s.reputation_score >= 80 ? 'text-green-400' : s.reputation_score >= 50 ? 'text-yellow-400' : 'text-red-400' },
                    { label: 'Weight', value: s.weight, icon: Activity, color: 'text-slate-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-100/50 rounded-lg p-2.5">
                      <p className={`text-base font-bold ${color}`}>{value ?? '—'}</p>
                      <p className="text-gray-600 text-xs mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Usage bars */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Hourly usage</span>
                      <span>{s.sent_last_hour} / {s.limit_per_hour} ({s.hourly_usage_pct}%)</span>
                    </div>
                    <UsageBar pct={s.hourly_usage_pct} color="bg-violet-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Daily usage</span>
                      <span>{s.sent_last_24h} / {s.limit_per_day} ({s.daily_usage_pct}%)</span>
                    </div>
                    <UsageBar pct={s.daily_usage_pct} color="bg-blue-500" />
                  </div>
                  <ReputationBar score={s.reputation_score} />
                </div>

                {/* Error */}
                {s.last_error && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    <span className="break-all">{s.last_error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
