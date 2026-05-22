import { useEffect, useState } from 'react'
import { Plus, Trash2, TestTube, Power, Edit, Server, Activity, RefreshCw, Zap, Clock, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Btn from '../components/Btn'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'
import ReputationBar from '../components/ReputationBar'
import { PageLoader } from '../components/LoadingSpinner'
import LoadingSpinner from '../components/LoadingSpinner'
import useAppStore from '../store/appStore'
import useDebounce from '../hooks/useDebounce'
import { smtpAPI } from '../services/api'

const EMPTY = {
  name: '', host: '', port: 587, username: '', password: '',
  secure: true, provider: '', limit_per_hour: 100, limit_per_day: 1000, weight: 1,
}

const STATUS_FILTERS = ['all', 'active', 'paused', 'error']

const PROVIDERS = ['SendGrid', 'Amazon SES', 'Mailgun', 'Brevo', 'Postmark', 'SparkPost', 'SMTP2GO', 'Custom']

function QuotaBar({ used, limit, color = '#6366f1' }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : color
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]" style={{ color: '#49566b' }}>
        <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: '#1e2840' }}>
        <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  const cls = status === 'active' ? 'dot-active' : status === 'error' ? 'dot-error' : 'dot-paused'
  return <span className={cls} />
}

const INPUT = 'input-base w-full'

export default function SMTPManager() {
  const { smtps, smtpsLoading, fetchSMTPs } = useAppStore()
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [showModal, setShowModal]         = useState(false)
  const [editSmtp, setEditSmtp]           = useState(null)
  const [form, setForm]                   = useState(EMPTY)
  const [saving, setSaving]               = useState(false)
  const [testing, setTesting]             = useState(null)
  const [deleteId, setDeleteId]           = useState(null)
  const dSearch = useDebounce(search)

  useEffect(() => { fetchSMTPs(dSearch, statusFilter === 'all' ? null : statusFilter) }, [dSearch, statusFilter])

  const openAdd  = () => { setEditSmtp(null); setForm(EMPTY); setShowModal(true) }
  const openEdit = (s) => { setEditSmtp(s); setForm({ ...s, password: '' }); setShowModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (editSmtp && !payload.password) delete payload.password
      if (editSmtp) {
        await smtpAPI.update(editSmtp.id, payload)
        toast.success('SMTP server updated')
      } else {
        await smtpAPI.create(payload)
        toast.success('SMTP server added')
      }
      setShowModal(false)
      fetchSMTPs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleTest = async (id) => {
    setTesting(id)
    try {
      const { data } = await smtpAPI.test(id)
      if (data.success) toast.success(`Connected in ${data.latency_ms}ms`)
      else toast.error(data.message || 'Connection failed')
    } catch { toast.error('Test failed') }
    finally { setTesting(null); fetchSMTPs() }
  }

  const handleToggle = async (id) => {
    try { await smtpAPI.toggle(id); fetchSMTPs() }
    catch { toast.error('Toggle failed') }
  }

  const handleDelete = async (id) => {
    try { await smtpAPI.delete(id); toast.success('SMTP deleted'); fetchSMTPs() }
    catch { toast.error('Delete failed') }
  }

  const f = (name, label, type = 'text', props = {}) => (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#8893a8' }}>{label}</label>
      <input
        type={type}
        value={form[name] ?? ''}
        onChange={(e) => setForm({ ...form, [name]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className={INPUT}
        {...props}
      />
    </div>
  )

  const active   = smtps.filter((s) => s.status === 'active').length
  const avgRep   = smtps.length ? (smtps.reduce((a, s) => a + (s.reputation_score || 0), 0) / smtps.length) : 0

  return (
    <div className="page-enter">
      <Header
        title="SMTP Manager"
        action={
          <Btn variant="primary" size="sm" icon={Plus} onClick={openAdd}>
            Add Server
          </Btn>
        }
      />

      <div className="p-6 space-y-5">

        {/* Summary cards */}
        {smtps.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Servers', value: smtps.length, color: '#818cf8' },
              { label: 'Active',        value: active,        color: '#34d399' },
              { label: 'Paused / Error',value: smtps.length - active, color: '#fbbf24' },
              {
                label: 'Avg Reputation',
                value: `${avgRep.toFixed(0)}%`,
                color: avgRep >= 80 ? '#34d399' : avgRep >= 50 ? '#fbbf24' : '#f87171',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-4 text-center" style={{ background: '#0c0f1a', border: '1px solid #1e2840' }}>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#49566b' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="Search servers..." className="w-56" />
            <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: '#0c0f1a', border: '1px solid #1e2840' }}>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all duration-150"
                  style={statusFilter === s
                    ? { background: '#6366f1', color: '#fff' }
                    : { color: '#49566b' }
                  }
                  onMouseEnter={(e) => { if (statusFilter !== s) e.currentTarget.style.color = '#8893a8' }}
                  onMouseLeave={(e) => { if (statusFilter !== s) e.currentTarget.style.color = '#49566b' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => fetchSMTPs(search, statusFilter === 'all' ? null : statusFilter)}>
            Refresh
          </Btn>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#0c0f1a', border: '1px solid #1e2840' }}>
          {smtpsLoading ? <PageLoader /> : smtps.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No SMTP servers yet"
              description="Add your first SMTP server to start sending emails with smart rotation and failover."
              action={<Btn variant="primary" size="md" icon={Plus} onClick={openAdd}>Add SMTP Server</Btn>}
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2840' }}>
                  {['Server', 'Status', 'Provider', 'Reputation', 'Hourly Quota', 'Daily Quota', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: '#49566b' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {smtps.map((smtp) => (
                  <tr
                    key={smtp.id}
                    className="group transition-colors duration-100 table-row-hover"
                    style={{ borderTop: '1px solid #1e2840' }}
                  >
                    {/* Server info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: '#101522', border: '1px solid #1e2840' }}
                        >
                          <Server size={14} style={{ color: '#818cf8' }} />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium leading-none">{smtp.name}</p>
                          <p className="text-xs mt-1" style={{ color: '#49566b' }}>
                            {smtp.host}:{smtp.port} · {smtp.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot status={smtp.status?.value || smtp.status} />
                        <Badge status={smtp.status?.value || smtp.status} dot={false} />
                      </div>
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3">
                      {smtp.provider ? (
                        <span
                          className="text-xs px-2 py-1 rounded-md font-medium"
                          style={{ background: '#101522', color: '#8893a8', border: '1px solid #1e2840' }}
                        >
                          {smtp.provider}
                        </span>
                      ) : (
                        <span style={{ color: '#49566b' }} className="text-xs">Custom</span>
                      )}
                    </td>

                    {/* Reputation */}
                    <td className="px-4 py-3 min-w-[120px]">
                      <ReputationBar score={smtp.reputation_score} />
                    </td>

                    {/* Hourly quota */}
                    <td className="px-4 py-3 min-w-[140px]">
                      <QuotaBar used={smtp.sent_last_hour || 0} limit={smtp.limit_per_hour} color="#6366f1" />
                    </td>

                    {/* Daily quota */}
                    <td className="px-4 py-3 min-w-[140px]">
                      <QuotaBar used={smtp.sent_last_24h || 0} limit={smtp.limit_per_day} color="#10b981" />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          onClick={() => handleTest(smtp.id)}
                          disabled={testing === smtp.id}
                          title="Test connection"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: '#49566b', border: '1px solid transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#49566b'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          {testing === smtp.id ? <LoadingSpinner size="sm" /> : <TestTube size={14} />}
                        </button>
                        <button
                          onClick={() => handleToggle(smtp.id)}
                          title={smtp.status === 'active' ? 'Pause' : 'Activate'}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{
                            color: (smtp.status?.value || smtp.status) === 'active' ? '#34d399' : '#49566b',
                            border: '1px solid transparent',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(smtp)}
                          title="Edit"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: '#49566b', border: '1px solid transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#818cf8'; e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#49566b'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(smtp.id)}
                          title="Delete"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: '#49566b', border: '1px solid transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#49566b'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editSmtp ? 'Edit SMTP Server' : 'Add SMTP Server'}
        description={editSmtp ? 'Update your SMTP server configuration.' : 'Connect an SMTP server to start sending emails.'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">

          {/* Name + Provider */}
          <div className="grid grid-cols-2 gap-4">
            {f('name', 'Display Name', 'text', { placeholder: 'SendGrid Primary', required: true })}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8893a8' }}>Provider</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="input-base"
                style={{ height: '36px', paddingRight: '12px' }}
              >
                <option value="">Select provider…</option>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">{f('host', 'SMTP Host', 'text', { placeholder: 'smtp.sendgrid.net', required: true })}</div>
            {f('port', 'Port', 'number', { required: true })}
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-4">
            {f('username', 'Username / API Key', 'text', { required: true })}
            {f('password', editSmtp ? 'Password (leave blank to keep)' : 'Password', 'password', { placeholder: '••••••••', required: !editSmtp })}
          </div>

          {/* Limits */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#49566b' }}>Rate limits & rotation</p>
            <div className="grid grid-cols-3 gap-4">
              {f('limit_per_hour', 'Emails / Hour', 'number')}
              {f('limit_per_day', 'Emails / Day', 'number')}
              {f('weight', 'Rotation Weight', 'number')}
            </div>
          </div>

          {/* TLS */}
          <label
            className="flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-colors"
            style={{ background: '#101522', border: '1px solid #1e2840' }}
          >
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(e) => setForm({ ...form, secure: e.target.checked })}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <div>
              <p className="text-white text-sm font-medium">Use TLS / SSL encryption</p>
              <p className="text-xs" style={{ color: '#49566b' }}>STARTTLS on port 587, SSL/TLS on port 465</p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Btn type="button" variant="secondary" size="md" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" size="md" className="flex-1" loading={saving}>
              {saving ? 'Saving…' : editSmtp ? 'Save Changes' : 'Add Server'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Delete SMTP Server"
        message="This will permanently remove this server. Historical send logs are preserved."
      />
    </div>
  )
}
