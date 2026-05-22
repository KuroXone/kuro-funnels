import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Send, TrendingUp, MousePointerClick, AlertCircle,
  Server, Megaphone, ListTodo, Activity, RefreshCw,
} from 'lucide-react'
import Header from '../components/Header'
import StatsCard from '../components/StatsCard'
import Badge from '../components/Badge'
import Btn from '../components/Btn'
import { PageLoader } from '../components/LoadingSpinner'
import useAppStore from '../store/appStore'
import { analyticsAPI, campaignsAPI } from '../services/api'

const DONUT_COLORS = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B']

const TOOLTIP_STYLE = {
  backgroundColor: '#1B2A42',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#F8FAFC',
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
  padding: '8px 12px',
}

export default function Dashboard() {
  const { dashboardStats, dashboardLoading, fetchDashboard } = useAppStore()
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [recentCampaigns, setRecentCampaigns] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboard()
    loadTimeline()
    loadRecentCampaigns()
    const t = setInterval(fetchDashboard, 30000)
    return () => clearInterval(t)
  }, [])

  const loadTimeline = async () => {
    setTimelineLoading(true)
    try {
      const { data } = await analyticsAPI.timeline(30)
      setTimeline(data)
    } catch { setTimeline([]) }
    finally { setTimelineLoading(false) }
  }

  const loadRecentCampaigns = async () => {
    try {
      const { data } = await campaignsAPI.list()
      const arr = Array.isArray(data) ? data : []
      setRecentCampaigns([...arr].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5))
    } catch { setRecentCampaigns([]) }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchDashboard(), loadTimeline(), loadRecentCampaigns()])
    setRefreshing(false)
  }

  const s = dashboardStats
  const rate = s?.delivery_rate ?? 0

  const pieData = s ? [
    { name: 'Opens',   value: s.total_opens   || 0 },
    { name: 'Clicks',  value: s.total_clicks  || 0 },
    { name: 'Bounces', value: s.total_bounces || 0 },
    { name: 'Other',   value: Math.max(0, (s.total_sent || 0) - (s.total_opens || 0) - (s.total_clicks || 0) - (s.total_bounces || 0)) },
  ] : []

  if (dashboardLoading && !s) return <><Header title="Dashboard" /><PageLoader /></>

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle="Overview"
        action={
          <Btn
            variant="ghost" size="sm"
            icon={refreshing ? undefined : RefreshCw}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing && <RefreshCw size={12} className="animate-spin" />}
            Refresh
          </Btn>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats row 1 */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Total Sent"   value={s?.total_sent?.toLocaleString() ?? '0'}   icon={Send}             color="blue"   subtitle="All time" />
          <StatsCard title="Open Rate"    value={`${s?.open_rate ?? 0}%`}                  icon={TrendingUp}       color="green"  subtitle={`${(s?.total_opens || 0).toLocaleString()} opens`} />
          <StatsCard title="Click Rate"   value={`${s?.click_rate ?? 0}%`}                 icon={MousePointerClick} color="purple" subtitle={`${(s?.total_clicks || 0).toLocaleString()} clicks`} />
          <StatsCard title="Bounce Rate"  value={`${s?.bounce_rate ?? 0}%`}                icon={AlertCircle}      color="orange" subtitle={`${(s?.total_bounces || 0).toLocaleString()} bounces`} />
        </div>

        {/* Stats row 2 */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="SMTP Servers"  value={s?.smtp_count ?? '—'}      icon={Server}    color="blue"   subtitle={`${s?.active_smtp ?? 0} active`} />
          <StatsCard title="Campaigns"     value={s?.campaign_count ?? '—'}  icon={Megaphone} color="purple" subtitle={`${s?.active_campaigns ?? 0} sending`} />
          <StatsCard title="Queue Pending" value={s?.queue_pending ?? '—'}   icon={ListTodo}  color="orange" subtitle="Awaiting dispatch" />
          <StatsCard title="Delivery Rate" value={`${rate}%`}                icon={Activity}  color="green"  subtitle="Successfully delivered" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Timeline area chart */}
          <div className="xl:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[#F8FAFC] font-semibold text-[14px]">Email Activity</h3>
                <p className="text-[#64748B] text-xs mt-0.5">Sent emails — last 30 days</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#10B981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            {timelineLoading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94A3B8', fontSize: 11 }} />
                  <Area type="monotone" dataKey="sent" stroke="#3B82F6" strokeWidth={2}
                    fill="url(#blueGrad)" dot={false} name="Sent" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Donut */}
          <div className="card p-5">
            <h3 className="text-[#F8FAFC] font-semibold text-[14px] mb-0.5">Engagement</h3>
            <p className="text-[#64748B] text-xs mb-4">Opens, clicks & bounces</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={54} outerRadius={78} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delivery health bar */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[#F8FAFC] font-semibold text-[14px]">Delivery Health</h3>
              <p className="text-[#64748B] text-xs mt-0.5">Overall email delivery success rate</p>
            </div>
            <span
              className="text-[22px] font-bold"
              style={{ color: rate >= 95 ? '#10B981' : rate >= 80 ? '#F59E0B' : '#EF4444' }}
            >
              {rate}%
            </span>
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${rate}%`,
                background: rate >= 95 ? '#10B981' : rate >= 80 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[#4E637A]">
            <span>0%</span><span>Target: 95%+</span><span>100%</span>
          </div>
        </div>

        {/* Recent campaigns */}
        {recentCampaigns.length > 0 && (
          <div className="tbl-wrap">
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-[#F8FAFC] font-semibold text-[14px]">Recent Campaigns</h3>
            </div>
            <table className="w-full">
              <thead className="tbl-head">
                <tr>
                  {['Campaign', 'Status', 'Recipients', 'Created'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c) => (
                  <tr key={c.id} className="tbl-row">
                    <td>
                      <p className="text-[#F8FAFC] text-sm font-medium">{c.name}</p>
                      <p className="text-[#64748B] text-xs truncate max-w-[240px]">{c.subject}</p>
                    </td>
                    <td><Badge status={c.status} /></td>
                    <td className="text-[#94A3B8] text-sm">{(c.total_recipients || 0).toLocaleString()}</td>
                    <td className="text-[#64748B] text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
