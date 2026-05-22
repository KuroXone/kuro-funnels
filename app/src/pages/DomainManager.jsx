import { useEffect, useState } from 'react'
import {
  Plus, Trash2, RefreshCw, Globe, CheckCircle, XCircle,
  AlertCircle, Copy, ChevronDown, ChevronUp, Key, Shield,
  Zap, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import ReputationBar from '../components/ReputationBar'
import { PageLoader } from '../components/LoadingSpinner'
import LoadingSpinner from '../components/LoadingSpinner'
import { domainsAPI } from '../services/api'

const STATUS_COLORS = {
  active: 'text-green-400',
  pending: 'text-yellow-400',
  partial: 'text-orange-400',
  error: 'text-red-400',
  suspended: 'text-red-500',
}

function CheckIcon({ valid, size = 16 }) {
  return valid
    ? <CheckCircle size={size} className="text-green-400 flex-shrink-0" />
    : <XCircle size={size} className="text-red-400 flex-shrink-0" />
}

function CopyButton({ value, label }) {
  const copy = () => {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copied!`)
  }
  return (
    <button onClick={copy} className="p-1.5 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-all" title="Copy">
      <Copy size={13} />
    </button>
  )
}

function DnsRecordRow({ type, host, value, purpose, copied }) {
  return (
    <div className="bg-gray-800/60 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded">{type}</span>
          <span className="text-xs text-gray-300 font-mono break-all">{host}</span>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <pre className="text-xs text-gray-400 font-mono flex-1 whitespace-pre-wrap break-all leading-relaxed">{value}</pre>
        <CopyButton value={value} label={type} />
      </div>
      {purpose && <p className="text-xs text-gray-600">{purpose}</p>}
    </div>
  )
}

export default function DomainManager() {
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDnsModal, setShowDnsModal] = useState(null)
  const [dnsRecords, setDnsRecords] = useState(null)
  const [dnsLoading, setDnsLoading] = useState(false)
  const [checkingId, setCheckingId] = useState(null)
  const [regenId, setRegenId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState({ domain: '', dkim_selector: 'kuro' })
  const [saving, setSaving] = useState(false)
  const [warmupTogglingId, setWarmupTogglingId] = useState(null)

  useEffect(() => { loadDomains() }, [])

  const loadDomains = async () => {
    setLoading(true)
    try {
      const { data } = await domainsAPI.list()
      setDomains(Array.isArray(data) ? data : [])
    } catch { setDomains([]) }
    finally { setLoading(false) }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await domainsAPI.create(form)
      toast.success(`Domain ${form.domain} added — configure DNS records now`)
      setShowAddModal(false)
      setForm({ domain: '', dkim_selector: 'kuro' })
      loadDomains()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add domain')
    } finally { setSaving(false) }
  }

  const handleCheckDns = async (id, domainName) => {
    setCheckingId(id)
    try {
      const { data } = await domainsAPI.checkDns(id)
      toast.success(`DNS check complete for ${domainName}`)
      loadDomains()
    } catch {
      toast.error('DNS check failed')
    } finally { setCheckingId(null) }
  }

  const handleShowDnsRecords = async (id) => {
    setShowDnsModal(id)
    setDnsLoading(true)
    setDnsRecords(null)
    try {
      const { data } = await domainsAPI.getDnsRecords(id)
      setDnsRecords(data)
    } catch { toast.error('Failed to load DNS records') }
    finally { setDnsLoading(false) }
  }

  const handleRegenDkim = async (id) => {
    setRegenId(id)
    try {
      await domainsAPI.regenerateDkim(id)
      toast.success('DKIM keys regenerated — update your DNS DKIM record')
      loadDomains()
      if (showDnsModal === id) handleShowDnsRecords(id)
    } catch { toast.error('Failed to regenerate DKIM') }
    finally { setRegenId(null) }
  }

  const handleDelete = async (id) => {
    try {
      await domainsAPI.delete(id)
      toast.success('Domain removed')
      loadDomains()
    } catch { toast.error('Delete failed') }
  }

  const handleToggleWarmup = async (domain) => {
    setWarmupTogglingId(domain.id)
    try {
      if (domain.warmup_enabled) {
        await domainsAPI.disableWarmup(domain.id)
        toast.success('Warmup disabled')
      } else {
        await domainsAPI.enableWarmup(domain.id)
        toast.success('Warmup enabled — starting at 20 emails/day')
      }
      loadDomains()
    } catch { toast.error('Failed to toggle warmup') }
    finally { setWarmupTogglingId(null) }
  }

  const allValid = (d) => d.spf_valid && d.dkim_valid && d.dmarc_valid

  return (
    <div>
      <Header
        title="Domain Manager"
        action={
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
            <Plus size={14} /> Add Domain
          </button>
        }
      />
      <div className="p-6 space-y-5">

        {/* Summary bar */}
        {domains.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Domains', value: domains.length, color: 'text-violet-400' },
              { label: 'Verified Active', value: domains.filter((d) => d.status === 'active').length, color: 'text-green-400' },
              { label: 'Warming Up', value: domains.filter((d) => d.warmup_enabled).length, color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Domain list */}
        {loading ? <PageLoader /> : domains.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No domains configured"
            description="Add a sending domain to get SPF, DKIM, and DMARC records for maximum deliverability."
            action={
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus size={14} /> Add Domain
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {domains.map((d) => (
              <div key={d.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-all">
                {/* Header row */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-violet-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Globe size={18} className="text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-semibold">{d.domain}</span>
                          <span className={`text-xs font-medium capitalize ${STATUS_COLORS[d.status] || 'text-gray-400'}`}>
                            {d.status === 'active' ? '● Active' : d.status === 'partial' ? '◐ Partial' : '○ ' + d.status}
                          </span>
                          {d.warmup_enabled && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Warming Up · Day {d.warmup_day}</span>
                          )}
                        </div>

                        {/* DNS check badges */}
                        <div className="flex items-center gap-3 flex-wrap mt-2">
                          {[
                            { label: 'SPF', valid: d.spf_valid },
                            { label: 'DKIM', valid: d.dkim_valid },
                            { label: 'DMARC', valid: d.dmarc_valid },
                            { label: 'MX', valid: d.mx_valid },
                          ].map(({ label, valid }) => (
                            <div key={label} className="flex items-center gap-1">
                              <CheckIcon valid={valid} size={13} />
                              <span className={`text-xs font-medium ${valid ? 'text-green-400' : 'text-gray-500'}`}>{label}</span>
                            </div>
                          ))}
                          {d.last_checked_at && (
                            <span className="text-xs text-gray-600 ml-2">
                              Checked {new Date(d.last_checked_at).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Reputation */}
                        <div className="mt-3 max-w-xs">
                          <ReputationBar score={d.reputation_score} />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => handleCheckDns(d.id, d.domain)}
                        disabled={checkingId === d.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-all"
                        title="Re-check DNS"
                      >
                        {checkingId === d.id ? <LoadingSpinner size="sm" /> : <RefreshCw size={12} />}
                        Check DNS
                      </button>
                      <button
                        onClick={() => handleShowDnsRecords(d.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-xs font-medium transition-all"
                      >
                        <Shield size={12} /> DNS Setup
                      </button>
                      <button
                        onClick={() => handleToggleWarmup(d)}
                        disabled={warmupTogglingId === d.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${d.warmup_enabled ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                      >
                        {warmupTogglingId === d.id ? <LoadingSpinner size="sm" /> : <Zap size={12} />}
                        {d.warmup_enabled ? 'Warmup On' : 'Warmup Off'}
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                        className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
                      >
                        {expandedId === d.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      <button onClick={() => setDeleteId(d.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === d.id && (
                  <div className="border-t border-gray-800 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Reputation Score', value: `${d.reputation_score?.toFixed(0)}%`, color: d.reputation_score >= 80 ? 'text-green-400' : d.reputation_score >= 50 ? 'text-yellow-400' : 'text-red-400' },
                      { label: 'Bounce Rate', value: `${d.bounce_rate?.toFixed(2)}%`, color: d.bounce_rate > 5 ? 'text-red-400' : 'text-green-400' },
                      { label: 'Complaint Rate', value: `${d.complaint_rate?.toFixed(2)}%`, color: d.complaint_rate > 0.2 ? 'text-red-400' : 'text-green-400' },
                      { label: 'Inbox Placement', value: `${d.inbox_placement?.toFixed(0)}%`, color: d.inbox_placement >= 90 ? 'text-green-400' : 'text-yellow-400' },
                      { label: 'DKIM Selector', value: d.dkim_selector, color: 'text-gray-300' },
                      { label: 'Warmup Day', value: d.warmup_enabled ? `Day ${d.warmup_day} / 14` : 'Disabled', color: 'text-orange-400' },
                      { label: 'Daily Limit', value: d.warmup_enabled ? d.warmup_daily_limit?.toLocaleString() : '—', color: 'text-gray-300' },
                      { label: 'Added', value: new Date(d.created_at).toLocaleDateString(), color: 'text-gray-500' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-gray-600 text-xs mb-0.5">{label}</p>
                        <p className={`text-sm font-medium ${color}`}>{value}</p>
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 flex gap-2 pt-2 border-t border-gray-800/50">
                      <button
                        onClick={() => handleRegenDkim(d.id)}
                        disabled={regenId === d.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-all"
                      >
                        {regenId === d.id ? <LoadingSpinner size="sm" /> : <Key size={12} />}
                        Regenerate DKIM Keys
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add domain modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Sending Domain" size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Domain</label>
            <input
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              required
              placeholder="yourdomain.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
            <p className="text-xs text-gray-600 mt-1">Enter the domain you'll send emails from (e.g. company.com)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">DKIM Selector</label>
            <input
              value={form.dkim_selector}
              onChange={(e) => setForm({ ...form, dkim_selector: e.target.value })}
              placeholder="kuro"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
            <p className="text-xs text-gray-600 mt-1">The DNS prefix for your DKIM record (e.g. "kuro" → kuro._domainkey.yourdomain.com)</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-400">After adding, we'll generate your SPF, DKIM, and DMARC DNS records. Paste them into your DNS provider, then click "Check DNS" to verify.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              {saving && <LoadingSpinner size="sm" />}
              {saving ? 'Adding...' : 'Add Domain'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DNS records modal */}
      <Modal isOpen={!!showDnsModal} onClose={() => { setShowDnsModal(null); setDnsRecords(null) }} title="DNS Configuration" size="xl">
        {dnsLoading ? (
          <div className="py-8 flex justify-center"><LoadingSpinner size="lg" /></div>
        ) : dnsRecords ? (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-xs text-yellow-400">Add these records to your DNS provider (Cloudflare, Route53, GoDaddy, etc.) then click "Check DNS" on the domain to verify.</p>
            </div>

            {['spf', 'dkim', 'dmarc'].map((type) => {
              const rec = dnsRecords.records?.[type]
              if (!rec) return null
              return (
                <div key={type}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{type.toUpperCase()}</p>
                  <DnsRecordRow
                    type={rec.type}
                    host={rec.host}
                    value={rec.value}
                    purpose={rec.purpose}
                  />
                </div>
              )
            })}

            <div className="pt-2 border-t border-gray-800">
              <p className="text-xs text-gray-500">TTL: 3600 (1 hour) recommended for all records. DNS changes may take up to 24 hours to propagate.</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">Failed to load DNS records</p>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Remove Domain"
        message="This will remove the domain and its DKIM keys. Make sure you also remove the DNS records."
      />
    </div>
  )
}
