import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Legend,
} from 'recharts'
import { Send, Eye, MousePointerClick, AlertCircle, ChevronDown, RefreshCw, TrendingUp, Package } from 'lucide-react'
import Header from '../components/Header'
import StatsCard from '../components/StatsCard'
import Btn from '../components/Btn'
import { PageLoader } from '../components/LoadingSpinner'
import useAppStore from '../store/appStore'
import { analyticsAPI, campaignsAPI } from '../services/api'

const TT = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.10)',
  borderRadius: '10px',
  color: '#0F172A',
  fontSize: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
  padding: '8px 12px',
}

const BAR_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#8B5CF6']

export default function Analytics() {
  const { dashboardStats, dashboardLoading, fetchDashboard } = useAppStore()
  const [timeline, setTimeline] = useState([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [campaignStats, setCampaignStats] = useState(null)
  const [campaignLoading, setCampaignLoading] = useState(false)

  useEffect(() => {
    fetchDashboard()
    loadCampaigns()
  }, [])

  useEffect(() => { loadTimeline() }, [days])

  useEffect(() => {
    if (selectedCampaign) loadCampaignStats(selectedCampaign)
    else setCampaignStats(null)
  }, [selectedCampaign])

  const loadTimeline = async () => {
    setLoading(true)
    try {
      const { data } = await analyticsAPI.timeline(days)
      setTimeline(data)
    } catch { setTimeline([]) }
    finally { setLoading(false) }
  }

  const loadCampaigns = async () => {
    try {
      const { data } = await campaignsAPI.list()
      setCampaigns(Array.isArray(data) ? data : [])
    } catch { setCampaigns([]) }
  }

  const loadCampaignStats = async (id) => {
    setCampaignLoading(true)
    try {
      const { data } = await analyticsAPI.campaign(id)
      setCampaignStats(data)
    } catch { setCampaignStats(null) }
    finally { setCampaignLoading(false) }
  }

  const s = dashboardStats
  const cs = campaignStats
  const rate = cs?.delivery_rate ?? s?.delivery_rate ?? 0

  const engagementData = [
    { label: 'Open Rate',     value: cs ? cs.open_rate     : (s?.open_rate     ?? 0), color: '#10B981' },
    { label: 'Click Rate',    value: cs ? cs.click_rate    : (s?.click_rate    ?? 0), color: '#3B82F6' },
    { label: 'Bounce Rate',   value: cs ? cs.bounce_rate   : (s?.bounce_rate   ?? 0), color: '#EF4444' },
    { label: 'Delivery Rate', value: cs ? cs.delivery_rate : (s?.delivery_rate ?? 0), color: '#8B5CF6' },
  ]

  return (
    <div>
      <Header
        title="Analytics"
        subtitle={selectedCampaign ? 'Campaign View' : `Last ${days} days`}
        action={
          <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => { fetchDashboard(); loadTimeline() }} />
        }
      />
      <div className="p-6 space-y-5">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="input-base pr-8 min-w-[220px]"
            >
              <option value="">All campaigns (overall)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedCampaign && (
            <button onClick={() => setSelectedCampaign('')}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Clear filter
            </button>
          )}
          {campaignLoading && (
            <div className="w-4 h-4 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
          )}
          {!selectedCampaign && (
            <div
              className="flex items-center gap-0.5 p-1 rounded-lg ml-auto"
              style={{ background: '#F5F7FB', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
                  style={days === d
                    ? { background: '#3B82F6', color: '#fff' }
                    : { color: '#475569' }
                  }
                  onMouseEnter={(e) => { if (days !== d) e.currentTarget.style.color = '#94A3B8' }}
                  onMouseLeave={(e) => { if (days !== d) e.currentTarget.style.color = '#64748B' }}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats cards */}
        {dashboardLoading && !s ? <PageLoader /> : (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="Total Sent"  value={(cs?.total_sent  ?? s?.total_sent)?.toLocaleString() ?? '—'} icon={Send}             color="blue"   />
            <StatsCard title="Open Rate"   value={`${cs?.open_rate  ?? s?.open_rate  ?? 0}%`}                  icon={Eye}              color="green"  subtitle={`${(cs?.total_opens ?? s?.total_opens ?? 0).toLocaleString()} opens`} />
            <StatsCard title="Click Rate"  value={`${cs?.click_rate ?? s?.click_rate ?? 0}%`}                  icon={MousePointerClick} color="purple" subtitle={`${(cs?.total_clicks ?? s?.total_clicks ?? 0).toLocaleString()} clicks`} />
            <StatsCard title="Bounce Rate" value={`${cs?.bounce_rate ?? s?.bounce_rate ?? 0}%`}                icon={AlertCircle}      color="orange" subtitle={`${(cs?.total_bounces ?? s?.total_bounces ?? 0).toLocaleString()} bounces`} />
          </div>
        )}

        {/* Main charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Timeline or campaign breakdown */}
          <div className="xl:col-span-2 card p-5">
            {!selectedCampaign ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-slate-800 font-semibold text-[14px]">Email Timeline</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Daily send volume</p>
                  </div>
                </div>
                {loading ? (
                  <div className="h-52 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={timeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={TT} labelStyle={{ color: '#475569', fontSize: 11 }} />
                      <Area type="monotone" dataKey="sent" stroke="#8B5CF6" strokeWidth={2}
                        fill="url(#purpleGrad)" dot={false} name="Sent" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </>
            ) : cs ? (
              <>
                <h3 className="text-slate-800 font-semibold text-[14px] mb-4">Campaign Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Sent',          value: cs.total_sent?.toLocaleString()         ?? '—', color: '#3B82F6' },
                    { label: 'Delivered',     value: cs.total_delivered?.toLocaleString()    ?? '—', color: '#10B981' },
                    { label: 'Opened',        value: cs.total_opens?.toLocaleString()        ?? '—', color: '#06B6D4' },
                    { label: 'Clicked',       value: cs.total_clicks?.toLocaleString()       ?? '—', color: '#8B5CF6' },
                    { label: 'Bounced',       value: cs.total_bounces?.toLocaleString()      ?? '—', color: '#EF4444' },
                    { label: 'Unsubscribed',  value: cs.total_unsubscribes?.toLocaleString() ?? '—', color: '#F59E0B' },
                    { label: 'Failed',        value: cs.total_failed?.toLocaleString()       ?? '—', color: '#DC2626' },
                    { label: 'SMTP Used',     value: cs.smtp_servers_used                   ?? '—', color: '#475569' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3.5"
                      style={{ background: '#F5F7FB', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <p className="text-[20px] font-bold leading-none" style={{ color }}>{value}</p>
                      <p className="text-[11px] text-slate-500 mt-1.5">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                Loading campaign data…
              </div>
            )}
          </div>

          {/* Engagement bar chart */}
          <div className="card p-5">
            <h3 className="text-slate-800 font-semibold text-[14px] mb-0.5">Engagement Rates</h3>
            <p className="text-slate-500 text-xs mb-4">
              {selectedCampaign ? 'Selected campaign' : 'Overall platform'}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engagementData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={TT} formatter={(v) => [`${v}%`]} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {engagementData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delivery health bar */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-slate-800 font-semibold text-[14px]">Delivery Rate</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {selectedCampaign ? 'For selected campaign' : 'Overall across all campaigns'}
              </p>
            </div>
            <span
              className="text-[22px] font-bold"
              style={{ color: rate >= 95 ? '#10B981' : rate >= 80 ? '#F59E0B' : '#EF4444' }}
            >
              {rate}%
            </span>
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${rate}%`,
                background: rate >= 95 ? '#10B981' : rate >= 80 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
            <span>0%</span>
            <span>Target: ≥95%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
