import { useEffect, useState, useRef } from 'react'
import {
  Plus, Play, Pause, Trash2, Edit, Send, Megaphone,
  CheckCircle2, Clock, Layers, RefreshCw, Mail,
  Calendar, FlaskConical, MoreHorizontal, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Btn from '../components/Btn'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'
import Pagination from '../components/Pagination'
import { PageLoader } from '../components/LoadingSpinner'
import useAppStore from '../store/appStore'
import useDebounce from '../hooks/useDebounce'
import { campaignsAPI } from '../services/api'

const EMPTY = {
  name: '', subject: '', from_name: '', from_email: '', reply_to: '',
  html_content: '<h1>Hello {{first_name}},</h1>\n<p>Your content here.</p>',
  text_content: '', contact_list_id: '', scheduled_at: '',
  track_opens: true, track_clicks: true,
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sending', label: 'Sending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
]

const PAGE_SIZE = 20
const STATUS_ORDER = ['sending', 'scheduled', 'draft', 'paused', 'completed', 'failed']
const B = '1px solid rgba(255,255,255,0.07)'

function StatChip({ icon: Icon, label, value, color }) {
  const colors = {
    blue:   { icon: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.2)'  },
    green:  { icon: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.2)'  },
    amber:  { icon: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.2)'  },
    slate:  { icon: '#64748B', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.15)' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <Icon size={16} style={{ color: c.icon }} />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4E637A]">{label}</p>
        <p className="text-[20px] font-bold text-[#F8FAFC] leading-tight">{value}</p>
      </div>
    </div>
  )
}

function ActionMenu({ campaign, onEdit, onSend, onPause, onTest, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const items = [
    ...((['draft', 'paused'].includes(campaign.status)) ? [{ icon: Play,        label: 'Send Now',  color: '#10B981', action: () => onSend(campaign.id) }] : []),
    ...(campaign.status === 'sending'                   ? [{ icon: Pause,       label: 'Pause',     color: '#F59E0B', action: () => onPause(campaign.id) }] : []),
    { icon: FlaskConical, label: 'Send Test', color: '#3B82F6', action: () => onTest(campaign) },
    { icon: Edit,         label: 'Edit',      color: '#8B5CF6', action: () => onEdit(campaign) },
    { divider: true },
    { icon: Trash2,       label: 'Delete',    color: '#EF4444', action: () => onDelete(campaign.id) },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-[#4E637A] hover:text-[#94A3B8] hover:bg-white/6"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 z-50 py-1 rounded-xl"
          style={{ background: '#1B2A42', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          {items.map((item, i) =>
            item.divider
              ? <div key={i} className="my-1" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
              : <MenuItem key={item.label} {...item} />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, color, action }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={action}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-all"
      style={{ color: h ? color : '#94A3B8', background: h ? 'rgba(255,255,255,0.04)' : 'transparent' }}
    >
      <Icon size={13} style={{ color: h ? color : '#64748B' }} />
      {label}
    </button>
  )
}

function ProgressBar({ value, total, color = '#3B82F6' }) {
  if (!total) return <span className="text-xs text-[#4E637A]">—</span>
  const pct = Math.min(100, Math.round((value / total) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', minWidth: 40 }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums text-[#64748B]">{pct}%</span>
    </div>
  )
}

function MetricPill({ value, color }) {
  if (value == null) return <span className="text-[#4E637A] text-xs">—</span>
  const pct = Math.round(value * 100) / 100
  const C = {
    blue:   { text: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.2)' },
    purple: { text: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.2)' },
  }
  const c = C[color] || C.blue
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
      {pct}%
    </span>
  )
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle}
      className="w-8 h-[18px] rounded-full relative cursor-pointer transition-all flex-shrink-0"
      style={{ background: on ? '#3B82F6' : 'rgba(255,255,255,0.1)' }}>
      <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all"
        style={{ left: on ? '18px' : '2px' }} />
    </div>
  )
}

export default function Campaigns() {
  const { campaigns, campaignsLoading, fetchCampaigns, contactLists, fetchContactLists } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [editCampaign, setEditCampaign] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [testCampaign, setTestCampaign] = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [editorMode, setEditorMode] = useState('html')
  const dSearch = useDebounce(search)

  useEffect(() => { fetchCampaigns(); fetchContactLists() }, [])
  useEffect(() => { setPage(1) }, [dSearch, statusFilter])

  const openAdd = () => { setEditCampaign(null); setForm(EMPTY); setEditorMode('html'); setShowModal(true) }
  const openEdit = (c) => { setEditCampaign(c); setForm({ ...c, contact_list_id: c.contact_list_id || '', scheduled_at: '' }); setEditorMode('html'); setShowModal(true) }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, contact_list_id: form.contact_list_id ? Number(form.contact_list_id) : null }
      if (editCampaign) { await campaignsAPI.update(editCampaign.id, payload); toast.success('Campaign updated') }
      else { await campaignsAPI.create(payload); toast.success('Campaign created') }
      setShowModal(false); fetchCampaigns()
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  const handleSend = async (id) => {
    try { await campaignsAPI.send(id); toast.success('Campaign started!'); fetchCampaigns() }
    catch (err) { toast.error(err.response?.data?.detail || 'Send failed') }
  }

  const handlePause = async (id) => {
    try { await campaignsAPI.pause(id); toast.success('Campaign paused'); fetchCampaigns() }
    catch { toast.error('Pause failed') }
  }

  const handleDelete = async (id) => {
    try { await campaignsAPI.delete(id); toast.success('Campaign deleted'); fetchCampaigns() }
    catch { toast.error('Delete failed') }
  }

  const handleTestEmail = async () => {
    try {
      await campaignsAPI.testEmail(testCampaign.id, { to_email: testEmail })
      toast.success(`Test sent to ${testEmail}`); setTestCampaign(null); setTestEmail('')
    } catch (err) { toast.error(err.response?.data?.detail || 'Test failed') }
  }

  const counts = campaigns.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})
  const filtered = campaigns
    .filter((c) => statusFilter === 'all' || c.status === statusFilter)
    .filter((c) => !dSearch || c.name.toLowerCase().includes(dSearch.toLowerCase()) || c.subject.toLowerCase().includes(dSearch.toLowerCase()))
  const sorted = [...filtered].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <Header
        title="Campaigns"
        subtitle={`${campaigns.length} total`}
        action={<Btn variant="primary" size="sm" icon={Plus} onClick={openAdd}>New Campaign</Btn>}
      />

      <div className="p-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatChip icon={Layers}       label="Total"     value={campaigns.length}       color="slate" />
          <StatChip icon={Zap}          label="Sending"   value={counts.sending || 0}    color="green" />
          <StatChip icon={Clock}        label="Scheduled" value={counts.scheduled || 0}  color="amber" />
          <StatChip icon={CheckCircle2} label="Completed" value={counts.completed || 0}  color="blue" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search campaigns…" className="w-full sm:w-64" />

          <div className="flex items-center gap-0.5 p-1 rounded-xl flex-wrap"
            style={{ background: '#121A2B', border: B }}>
            {STATUS_TABS.map(({ key, label }) => {
              const cnt = key === 'all' ? campaigns.length : (counts[key] || 0)
              const active = statusFilter === key
              return (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap"
                  style={active
                    ? { background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }
                    : { color: '#4E637A', border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#94A3B8' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#4E637A' }}
                >
                  {label}
                  {cnt > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={active
                        ? { background: 'rgba(59,130,246,0.2)', color: '#60A5FA' }
                        : { background: 'rgba(255,255,255,0.07)', color: '#64748B' }
                      }>{cnt}</span>
                  )}
                </button>
              )
            })}
          </div>

          <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={fetchCampaigns} className="sm:ml-auto" />
        </div>

        {/* Table */}
        {campaignsLoading ? <PageLoader /> : sorted.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns found"
            description={dSearch || statusFilter !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Create your first email campaign to get started'}
            action={!dSearch && statusFilter === 'all'
              ? <Btn variant="primary" size="md" icon={Plus} onClick={openAdd}>New Campaign</Btn>
              : null}
          />
        ) : (
          <div className="tbl-wrap">
            <table className="w-full">
              <thead className="tbl-head">
                <tr>
                  {['Campaign', 'Status', 'Opens', 'Clicks', 'Progress', 'Created', ''].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => {
                  const openRate  = c.sent_count ? c.open_count  / c.sent_count * 100 : null
                  const clickRate = c.sent_count ? c.click_count / c.sent_count * 100 : null
                  return (
                    <tr key={c.id} className="tbl-row">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(255,255,255,0.06)', border: B }}>
                            <Mail size={12} className="text-[#4E637A]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[#F8FAFC] font-medium text-[13px] truncate">{c.name}</p>
                            <p className="text-[11px] text-[#64748B] truncate max-w-[260px]">{c.subject}</p>
                          </div>
                        </div>
                      </td>
                      <td><Badge status={c.status} /></td>
                      <td><MetricPill value={openRate} color="blue" /></td>
                      <td><MetricPill value={clickRate} color="purple" /></td>
                      <td style={{ minWidth: 120 }}>
                        <p className="text-[11px] text-[#4E637A] mb-1">
                          {(c.sent_count || 0).toLocaleString()} / {(c.total_recipients || 0).toLocaleString()}
                        </p>
                        <ProgressBar
                          value={c.sent_count || 0}
                          total={c.total_recipients || 0}
                          color={c.status === 'sending' ? '#10B981' : '#3B82F6'}
                        />
                      </td>
                      <td>
                        <p className="text-[12px] text-[#94A3B8]">
                          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-[11px] text-[#4E637A]">{new Date(c.created_at).getFullYear()}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          {['draft', 'paused'].includes(c.status) && (
                            <button onClick={() => handleSend(c.id)}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                              style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.18)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                            ><Play size={10} /> Send</button>
                          )}
                          {c.status === 'sending' && (
                            <button onClick={() => handlePause(c.id)}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                              style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245,158,11,0.18)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                            ><Pause size={10} /> Pause</button>
                          )}
                          <ActionMenu
                            campaign={c}
                            onEdit={openEdit} onSend={handleSend} onPause={handlePause}
                            onTest={(cam) => { setTestCampaign(cam); setTestEmail('') }}
                            onDelete={(id) => setDeleteId(id)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={page} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Campaign Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editCampaign ? 'Edit Campaign' : 'New Campaign'}
        description={editCampaign ? 'Update your campaign settings' : 'Configure and launch a new email campaign'}
        size="xl">
        <form onSubmit={handleSave}>
          {/* Section: Details */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E637A] mb-3">Campaign Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">Campaign Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Summer Promo 2025" className="input-base" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">Subject Line <span className="text-red-400">*</span></label>
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="Don't miss this…" className="input-base" />
              </div>
            </div>
          </div>

          {/* Section: Sender */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E637A] mb-3">Sender Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">From Name <span className="text-red-400">*</span></label>
                <input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} required placeholder="Jane at Company" className="input-base" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">From Email <span className="text-red-400">*</span></label>
                <input type="email" value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} required placeholder="hello@company.com" className="input-base" />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">Reply-To <span className="text-[#4E637A] font-normal">(optional)</span></label>
                <input type="email" value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} placeholder="replies@company.com" className="input-base" />
              </div>
            </div>
          </div>

          {/* Section: Targeting */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E637A] mb-3">Targeting & Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">Contact List</label>
                <select value={form.contact_list_id} onChange={(e) => setForm({ ...form, contact_list_id: e.target.value })} className="input-base">
                  <option value="">Select a list…</option>
                  {contactLists.map((l) => <option key={l.id} value={l.id}>{l.name} ({(l.contact_count || 0).toLocaleString()})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5">Schedule <span className="text-[#4E637A] font-normal">(optional)</span></label>
                <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="input-base" />
              </div>
            </div>
          </div>

          {/* Section: Content */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E637A]">Email Content</p>
              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: '#121A2B', border: B }}>
                {['html', 'text'].map((mode) => (
                  <button key={mode} type="button" onClick={() => setEditorMode(mode)}
                    className="px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-all"
                    style={editorMode === mode ? { background: '#3B82F6', color: '#fff' } : { color: '#4E637A' }}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={editorMode === 'html' ? form.html_content : form.text_content}
              onChange={(e) => setForm({ ...form, [editorMode === 'html' ? 'html_content' : 'text_content']: e.target.value })}
              rows={8}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-y scrollbar-thin"
              style={{ background: '#121A2B', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', outline: 'none', minHeight: 160 }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] text-[#4E637A]">Variables:</span>
              {['{{first_name}}', '{{last_name}}', '{{email}}', '{{unsubscribe_link}}'].map((v) => (
                <button key={v} type="button"
                  onClick={() => setForm((f) => ({ ...f, [editorMode === 'html' ? 'html_content' : 'text_content']: f[editorMode === 'html' ? 'html_content' : 'text_content'] + v }))}
                  className="px-2 py-0.5 rounded text-[11px] font-mono transition-all"
                  style={{ background: '#121A2B', border: B, color: '#8B5CF6' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = '#121A2B' }}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* Section: Tracking */}
          <div className="mb-6 p-4 rounded-xl" style={{ background: '#121A2B', border: B }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E637A] mb-3">Tracking</p>
            <div className="flex items-center gap-6">
              {[
                { key: 'track_opens',  label: 'Track Opens',  sub: 'Pixel tracking' },
                { key: 'track_clicks', label: 'Track Clicks', sub: 'Link redirect' },
              ].map(({ key, label, sub }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <Toggle on={form[key]} onToggle={() => setForm({ ...form, [key]: !form[key] })} />
                  <div>
                    <p className="text-[12px] font-medium text-[#F8FAFC]">{label}</p>
                    <p className="text-[10px] text-[#4E637A]">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Btn type="button" variant="secondary" size="md" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" size="md" className="flex-1" loading={saving}>
              {saving ? 'Saving…' : editCampaign ? 'Save Changes' : 'Create Campaign'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Test Email Modal */}
      <Modal isOpen={!!testCampaign} onClose={() => { setTestCampaign(null); setTestEmail('') }}
        title="Send Test Email"
        description={testCampaign ? `Testing: ${testCampaign.name}` : ''}
        size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wide">Recipient Address</label>
            <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="yourname@example.com" className="input-base" autoFocus />
            <p className="text-[11px] mt-2 text-[#4E637A]">Variables replaced with sample data.</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" size="md" className="flex-1" onClick={() => { setTestCampaign(null); setTestEmail('') }}>Cancel</Btn>
            <Btn variant="primary" size="md" className="flex-1" icon={Send} disabled={!testEmail} onClick={handleTestEmail}>Send Test</Btn>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { handleDelete(deleteId); setDeleteId(null) }}
        title="Delete Campaign"
        message="This will permanently delete the campaign and all associated data." />
    </div>
  )
}
