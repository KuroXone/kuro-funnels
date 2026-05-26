import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Globe, CheckCircle, XCircle, Copy,
  Search, Loader2, ArrowLeft, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import { domainsAPI } from '../services/api'

const PAGE_SIZE = 10

/* ─── helpers ────────────────────────────────────────────────── */

function domainStatus(d) {
  if (d.status === 'active')  return { dot: 'bg-emerald-500', text: 'Authenticated',           cls: 'text-emerald-600' }
  if (d.status === 'partial') return { dot: 'bg-amber-400',   text: 'Partially authenticated', cls: 'text-amber-600'   }
  return                             { dot: 'bg-red-500',     text: 'Not authenticated',        cls: 'text-slate-500'   }
}

/* ─── copy button ─────────────────────────────────────────────── */

function CopyBtn({ value }) {
  const [ok, setOk] = useState(false)
  const go = () => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1400) }
  return (
    <button onClick={go} className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}>
      {ok ? <CheckCircle size={10} /> : <Copy size={10} />}
      {ok ? 'Copied' : 'Copy'}
    </button>
  )
}

/* ─── method radio card ──────────────────────────────────────── */

function MethodCard({ id, title, badge, desc, selected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(id)}
      className={`border-2 rounded-xl p-4 cursor-pointer transition-all select-none ${selected ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'}`}>
          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px] text-slate-800">{title}</span>
            {badge && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">{badge}</span>}
          </div>
          <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── DNS record row ──────────────────────────────────────────── */

const TYPE_CLR = { TXT: '#8B5CF6', CNAME: '#3B82F6', MX: '#F59E0B' }

function DnsRecordRow({ type, host, value, status }) {
  const c  = TYPE_CLR[type] || '#64748B'
  const st = status === 'valid' ? 'verified' : status === 'invalid' ? 'failed' : 'pending'
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: `${c}18`, color: c }}>{type}</span>
        <span className={`text-[11px] font-medium flex items-center gap-1 ${st === 'verified' ? 'text-emerald-600' : st === 'failed' ? 'text-red-500' : 'text-yellow-600'}`}>
          {st === 'verified' ? <CheckCircle size={10} /> : st === 'failed' ? <XCircle size={10} /> : <Loader2 size={10} className="animate-spin" />}
          {st}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 w-10 uppercase flex-shrink-0">Host</span>
          <code className="text-[11px] font-mono text-slate-700 flex-1 truncate">{host}</code>
          <CopyBtn value={host} />
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-bold text-slate-400 w-10 uppercase flex-shrink-0 mt-0.5">Value</span>
          <pre className="text-[11px] font-mono text-slate-700 flex-1 whitespace-pre-wrap break-all leading-relaxed">{value}</pre>
          <CopyBtn value={value} />
        </div>
      </div>
    </div>
  )
}

/* ─── main page ──────────────────────────────────────────────── */

export default function DomainManager() {
  /* list */
  const [domains, setDomains]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const pollRef = useRef(null)

  /* step 1 — add form */
  const [addOpen, setAddOpen]       = useState(false)
  const [addDomain, setAddDomain]   = useState('')
  const [addSaving, setAddSaving]   = useState(false)

  /* step 2+ — auth modal state machine */
  const [authOpen, setAuthOpen]       = useState(false)
  const [authDomain, setAuthDomain]   = useState(null)
  const [authMethod, setAuthMethod]   = useState('auto')
  // phases: select | auto-running | auto-done | auto-error | manual-loading | manual-records | share
  const [phase, setPhase]             = useState('select')
  const [autoMsg, setAutoMsg]         = useState('')
  const [dnsRecs, setDnsRecs]         = useState(null)
  const [dnsStat, setDnsStat]         = useState([])

  /* verify / delete */
  const [verifyingId, setVerifyingId] = useState(null)
  const [deleteId, setDeleteId]       = useState(null)

  /* ── data ─────────────────────────────────────────────────── */

  const loadDomains = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { const { data } = await domainsAPI.list(); setDomains(Array.isArray(data) ? data : []) }
    catch {}
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { loadDomains() }, [loadDomains])

  /* sync authDomain when list refreshes */
  useEffect(() => {
    if (authDomain) {
      const fresh = domains.find(d => d.id === authDomain.id)
      if (fresh) setAuthDomain(fresh)
    }
  }, [domains]) // eslint-disable-line react-hooks/exhaustive-deps

  /* auto-poll while any domain is unverified */
  useEffect(() => {
    const pending = domains.some(d => d.status === 'pending' || d.status === 'partial')
    if (pending && !pollRef.current) {
      pollRef.current = setInterval(() => loadDomains(true), 8000)
    } else if (!pending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [domains, loadDomains])

  useEffect(() => () => clearInterval(pollRef.current), [])

  /* ── pagination ───────────────────────────────────────────── */

  const filtered   = domains.filter(d => d.domain.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /* ── add domain ───────────────────────────────────────────── */

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddSaving(true)
    try {
      const { data } = await domainsAPI.create({ domain: addDomain, dkim_selector: 'kuro' })
      toast.success(`${addDomain} added`)
      setAddOpen(false)
      setAddDomain('')
      await loadDomains()
      openAuth(data)          // go straight to step 2
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add domain')
    } finally { setAddSaving(false) }
  }

  /* ── auth modal ───────────────────────────────────────────── */

  const openAuth = async (domain, skipToRecords = false) => {
    setAuthDomain(domain)
    setAuthMethod('auto')
    setAutoMsg('')
    setDnsRecs(null)
    setDnsStat([])
    setAuthOpen(true)
    if (skipToRecords) {
      setPhase('manual-loading')
      await _loadRecords(domain.id)
    } else {
      setPhase('select')
    }
  }

  const _loadRecords = async (id) => {
    try {
      const [r, s] = await Promise.allSettled([domainsAPI.getDnsRecords(id), domainsAPI.getRecordStatuses(id)])
      if (r.status === 'fulfilled') setDnsRecs(r.value.data)
      if (s.status === 'fulfilled') setDnsStat(s.value.data || [])
    } catch {}
    setPhase('manual-records')
  }

  const handleContinue = async () => {
    if (authMethod === 'auto') {
      setPhase('auto-running')
      try {
        await domainsAPI.provision(authDomain.id)
        setPhase('auto-done')
        setTimeout(() => loadDomains(true), 3000)
      } catch (err) {
        setAutoMsg(err.response?.data?.detail || 'Set CLOUDFLARE_API_TOKEN in backend .env to enable automatic DNS.')
        setPhase('auto-error')
      }
    } else if (authMethod === 'manual') {
      setPhase('manual-loading')
      await _loadRecords(authDomain.id)
    } else {
      /* share: copy records as plain text */
      setPhase('manual-loading')
      try {
        const { data: r } = await domainsAPI.getDnsRecords(authDomain.id)
        const rec = r.records
        const txt = [
          `DNS records for ${authDomain.domain}`, '',
          `SPF   TXT   ${rec.spf?.host}`, `      ${rec.spf?.value}`, '',
          `DKIM  TXT   ${rec.dkim?.host}`, `      ${rec.dkim?.value}`, '',
          `DMARC TXT   ${rec.dmarc?.host}`, `      ${rec.dmarc?.value}`, '',
          `Track CNAME ${rec.tracking?.host}`, `      ${rec.tracking?.value}`,
        ].join('\n')
        navigator.clipboard.writeText(txt)
        toast.success('DNS records copied to clipboard')
      } catch {}
      setPhase('share')
    }
  }

  /* ── verify ───────────────────────────────────────────────── */

  const handleVerify = async (id) => {
    setVerifyingId(id)
    try {
      const { data } = await domainsAPI.verify(id)
      if (data.status === 'active')       toast.success(`${data.domain} verified!`)
      else if (data.status === 'partial') toast(`Some records still pending`, { icon: '⚠️' })
      else                                toast(`DNS not detected yet — propagation can take up to 48h`, { icon: '⏳' })
      await loadDomains()
      if (authOpen && authDomain?.id === id && phase === 'manual-records') {
        const { data: s } = await domainsAPI.getRecordStatuses(id)
        setDnsStat(s || [])
      }
    } catch { toast.error('Verification failed') }
    finally { setVerifyingId(null) }
  }

  /* ── auth modal title ─────────────────────────────────────── */

  const authTitle =
    phase === 'select'                         ? `Authenticate ${authDomain?.domain || ''}` :
    phase === 'auto-running' || phase === 'auto-done' || phase === 'auto-error' ? 'Automatic DNS setup' :
    phase === 'manual-loading' || phase === 'manual-records'                    ? 'Manual DNS records'  :
    'Share DNS setup'

  const hasPending = domains.some(d => d.status === 'pending' || d.status === 'partial')

  /* ── render ───────────────────────────────────────────────── */

  return (
    <div>
      <Header
        title="Domains"
        subtitle={
          <span className="flex items-center gap-2">
            {domains.length} domain{domains.length !== 1 ? 's' : ''}
            {hasPending && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded-full">
                <Loader2 size={8} className="animate-spin" /> Auto-checking
              </span>
            )}
          </span>
        }
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} /> Add domain
          </button>
        }
      />

      <div className="p-6 space-y-4">

        {/* search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search domain by name"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
          />
        </div>

        {/* table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

          {/* header row */}
          <div className="grid grid-cols-[1fr_220px_180px_44px] px-5 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Domain name</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Domain status</span>
            <span />
            <span />
          </div>

          {/* body */}
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center">
              <Globe size={36} className="mx-auto text-slate-200 mb-3" />
              <p className="text-[14px] font-semibold text-slate-600 mb-1">
                {search ? 'No domains match your search' : 'No domains yet'}
              </p>
              <p className="text-[12px] text-slate-400 mb-4">
                {search ? 'Try a different search term' : 'Add your sending domain to get started'}
              </p>
              {!search && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-[13px] font-medium rounded-xl hover:bg-slate-700 transition-colors"
                >
                  <Plus size={14} /> Add domain
                </button>
              )}
            </div>
          ) : (
            paginated.map((d, i) => {
              const info   = domainStatus(d)
              const isLast = i === paginated.length - 1
              return (
                <div
                  key={d.id}
                  className={`grid grid-cols-[1fr_220px_180px_44px] px-5 py-4 items-center hover:bg-slate-50/50 transition-colors ${!isLast ? 'border-b border-slate-100' : ''}`}
                >
                  {/* name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe size={14} className="text-slate-300 flex-shrink-0" />
                    <span className="font-medium text-[14px] text-slate-800 truncate">{d.domain}</span>
                  </div>

                  {/* status */}
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${info.dot}`} />
                    <span className={`text-[13px] ${info.cls}`}>{info.text}</span>
                  </div>

                  {/* actions */}
                  <div className="flex items-center gap-3">
                    {d.status === 'active' ? (
                      <button
                        onClick={() => openAuth(d, true)}
                        className="text-[13px] text-slate-400 hover:text-slate-600 hover:underline"
                      >
                        View records
                      </button>
                    ) : (
                      <button
                        onClick={() => openAuth(d)}
                        className="text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Authenticate
                      </button>
                    )}
                    <button
                      onClick={() => handleVerify(d.id)}
                      disabled={verifyingId === d.id}
                      title="Verify DNS now"
                      className="p-1 text-slate-300 hover:text-slate-500 disabled:opacity-40 rounded transition-colors"
                    >
                      {verifyingId === d.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <RefreshCw size={13} />}
                    </button>
                  </div>

                  {/* delete */}
                  <button
                    onClick={() => setDeleteId(d.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })
          )}

          {/* pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-[12px] text-slate-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">
                  <ChevronLeft size={14} className="text-slate-600" />
                </button>
                <span className="text-[12px] text-slate-600 px-1">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ STEP 1: Add domain modal ══════════════════════════════ */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add a domain" size="sm">
        <form onSubmit={handleAdd} className="space-y-5">
          <p className="text-[13px] text-slate-500">Enter the email sending domain name you want to add.</p>
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1">
              Domain name <span className="text-red-400">*</span>
            </label>
            <p className="text-[11px] text-slate-400 mb-2">Example: mondomaine.com</p>
            <input
              value={addDomain}
              onChange={e => setAddDomain(e.target.value)}
              required
              placeholder="mondomaine.com"
              autoFocus
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-[13px] font-medium text-blue-600 hover:text-blue-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={addSaving || !addDomain.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors"
            >
              {addSaving && <Loader2 size={13} className="animate-spin" />}
              Add domain
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ STEP 2+: Auth modal ═══════════════════════════════════ */}
      <Modal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        title={authTitle}
        size={phase === 'manual-records' ? 'xl' : 'md'}
      >

        {/* ── choose method ── */}
        {phase === 'select' && (
          <div className="space-y-3">
            <MethodCard
              id="auto" selected={authMethod === 'auto'} onSelect={setAuthMethod}
              title="Automatically configure domain" badge="Recommended"
              desc="Automatically create DNS records in your domain provider by allowing us to add them for you. Requires Cloudflare API token on the backend."
            />
            <MethodCard
              id="manual" selected={authMethod === 'manual'} onSelect={setAuthMethod}
              title="Manually configure the domain yourself"
              desc="Configure domain records in your DNS provider account manually. We'll show you the exact records to add."
            />
            <MethodCard
              id="share" selected={authMethod === 'share'} onSelect={setAuthMethod}
              title="Ask someone else to configure the domain for you"
              desc="Copy the DNS records as text and share with your DNS administrator."
            />
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setAuthOpen(false)} className="px-4 py-2 text-[13px] font-medium text-blue-600 hover:text-blue-700">Cancel</button>
              <button
                onClick={handleContinue}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── auto: running ── */}
        {phase === 'auto-running' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center">
              <Loader2 size={24} className="text-blue-500 animate-spin" />
            </div>
            <p className="text-[14px] font-semibold text-slate-700">Configuring DNS records…</p>
            <p className="text-[12px] text-slate-400 text-center">Connecting to Cloudflare and creating SPF, DKIM, DMARC records</p>
          </div>
        )}

        {/* ── auto: done ── */}
        {phase === 'auto-done' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <p className="text-[15px] font-semibold text-slate-800">DNS records are being created</p>
            <p className="text-[12px] text-slate-500 text-center max-w-[280px]">
              Records are being pushed to Cloudflare. Verification runs automatically — it may take a few minutes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('manual-loading'); _loadRecords(authDomain.id) }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-medium rounded-xl"
              >
                View records
              </button>
              <button onClick={() => setAuthOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-semibold rounded-xl">
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── auto: error ── */}
        {phase === 'auto-error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-amber-800">Automatic setup unavailable</p>
                <p className="text-[12px] text-amber-700 mt-1">{autoMsg}</p>
              </div>
            </div>
            <p className="text-[13px] text-slate-600">Use manual setup instead — add the DNS records to your provider yourself.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPhase('select')} className="flex items-center gap-1 px-4 py-2 text-[13px] text-slate-500 hover:text-slate-700">
                <ArrowLeft size={12} /> Back
              </button>
              <button
                onClick={async () => { setAuthMethod('manual'); setPhase('manual-loading'); await _loadRecords(authDomain.id) }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-semibold rounded-xl"
              >
                Set up manually
              </button>
            </div>
          </div>
        )}

        {/* ── manual / share: loading ── */}
        {phase === 'manual-loading' && (
          <div className="py-12 flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-[13px] text-slate-400">Loading DNS records…</p>
          </div>
        )}

        {/* ── manual: records ── */}
        {phase === 'manual-records' && dnsRecs && (
          <div className="space-y-4">
            {/* status bar */}
            {authDomain && (
              <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${authDomain.status === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  {authDomain.status === 'active'
                    ? <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                    : <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />}
                  <span className="text-[12px] font-medium text-slate-700">
                    {authDomain.status === 'active'
                      ? 'All records verified — domain is active'
                      : 'Add these records to your DNS provider'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {[['SPF', 'spf_valid'], ['DKIM', 'dkim_valid'], ['DMARC', 'dmarc_valid']].map(([lbl, k]) => (
                    <span key={lbl} className={`flex items-center gap-0.5 text-[11px] font-medium ${authDomain[k] ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {authDomain[k] ? <CheckCircle size={10} /> : <XCircle size={10} />} {lbl}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[12px] text-slate-500">
              Add these 4 records to your DNS provider, then click <strong>Verify</strong>.
              Auto-check runs every 5 minutes — propagation can take up to 48h.
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-0.5">
              {['spf', 'dkim', 'dmarc', 'tracking'].map(key => {
                const rec = dnsRecs.records?.[key]
                if (!rec) return null
                const rtype = key.toUpperCase()
                const sr    = dnsStat.find(s => s.record_type === rtype)
                return (
                  <DnsRecordRow
                    key={key}
                    type={rec.type}
                    host={rec.host}
                    value={rec.value}
                    status={sr?.status}
                  />
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button onClick={() => setPhase('select')} className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-600">
                <ArrowLeft size={12} /> Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVerify(authDomain.id)}
                  disabled={verifyingId === authDomain?.id}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl transition-colors"
                >
                  {verifyingId === authDomain?.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Verify now
                </button>
                <button onClick={() => setAuthOpen(false)} className="px-4 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl">
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── share: done ── */}
        {phase === 'share' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-800">DNS records copied to clipboard</p>
                <p className="text-[12px] text-emerald-700 mt-0.5">Paste and send to your DNS administrator to configure.</p>
              </div>
            </div>
            <p className="text-[12px] text-slate-500">Once records are added, click Verify or wait — auto-check runs every 5 minutes.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setPhase('manual-loading'); _loadRecords(authDomain.id) }}
                className="px-4 py-2 text-[13px] text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl"
              >
                View records
              </button>
              <button onClick={() => setAuthOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-semibold rounded-xl">
                Done
              </button>
            </div>
          </div>
        )}

      </Modal>

      {/* ══ delete confirm ════════════════════════════════════════ */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          domainsAPI.delete(deleteId)
            .then(() => { toast.success('Domain removed'); loadDomains() })
            .catch(() => toast.error('Delete failed'))
          setDeleteId(null)
        }}
        title="Remove Domain"
        message="This removes the domain and its DKIM keys. Existing records at your DNS provider are not deleted."
      />
    </div>
  )
}
