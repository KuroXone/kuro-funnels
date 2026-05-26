import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Copy, Sparkles, FileText, Eye, Code2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'
import { PageLoader } from '../components/LoadingSpinner'
import useDebounce from '../hooks/useDebounce'
import { templatesAPI } from '../services/api'

const CATEGORIES = ['all', 'general', 'onboarding', 'newsletter', 'promotional', 'transactional']

const CAT_COLORS = {
  general:       { text: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)' },
  onboarding:    { text: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' },
  newsletter:    { text: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
  promotional:   { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' },
  transactional: { text: '#06B6D4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.25)'  },
}

const EMPTY_FORM = {
  name: '', subject: '', category: 'general',
  html_content: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0B1020;font-family:'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#162033;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#3B82F6,#8B5CF6);padding:40px;text-align:center;">
          <h1 style="color:#fff;font-size:26px;margin:0;font-weight:700;">{{headline}}</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#94A3B8;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi {{first_name}},</p>
          <p style="color:#94A3B8;font-size:15px;line-height:1.7;margin:0 0 32px;">{{body_text}}</p>
          <div style="text-align:center;">
            <a href="{{cta_url}}" style="background:#3B82F6;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">{{cta_text}}</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid rgba(0,0,0,0.08);padding:20px 40px;text-align:center;">
          <p style="color:#64748B;font-size:12px;margin:0"><a href="{{unsubscribe_url}}" style="color:#3B82F6;text-decoration:none;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  text_content: '',
}

const VARIABLES = ['{{first_name}}', '{{last_name}}', '{{email}}', '{{company_name}}', '{{headline}}', '{{body_text}}', '{{cta_text}}', '{{cta_url}}', '{{unsubscribe_url}}']
const B = '1px solid rgba(0,0,0,0.08)'

function CatBadge({ cat }) {
  const c = CAT_COLORS[cat] || CAT_COLORS.general
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide capitalize"
      style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
      {cat}
    </span>
  )
}

function TemplateCard({ tpl, onEdit, onDuplicate, onDelete }) {
  const [hov, setHov] = useState(false)
  const stripped = tpl.html_content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden transition-all cursor-default"
      style={{
        background: '#FFFFFF',
        border: `1px solid ${hov ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.12)' : 'var(--shadow-sm)',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Preview */}
      <div className="relative overflow-hidden flex-shrink-0"
        style={{ height: 110, background: '#F0F2F7', borderBottom: B }}>
        <iframe
          srcDoc={tpl.html_content}
          className="w-full border-0 pointer-events-none"
          style={{ height: 440, transform: 'scale(0.25)', transformOrigin: 'top left', width: '400%' }}
          title={tpl.name}
          sandbox="allow-same-origin"
        />
        <div className="absolute inset-x-0 bottom-0 h-10"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(240,242,247,0.95))' }} />
        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(0,0,0,0.65)', opacity: hov ? 1 : 0, backdropFilter: 'blur(2px)' }}
        >
          <button onClick={() => onEdit(tpl)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
            style={{ background: '#3B82F6', border: '1px solid rgba(59,130,246,0.4)' }}>
            <Edit size={11} /> Edit
          </button>
          <button onClick={() => onDuplicate(tpl)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.10)', color: '#475569' }}>
            <Copy size={11} /> Copy
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-slate-800 font-semibold text-[13px] truncate">{tpl.name}</p>
              {tpl.is_default && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }}>
                  Default
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">{tpl.subject || 'No subject'}</p>
          </div>
          <CatBadge cat={tpl.category || 'general'} />
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{stripped.slice(0, 100) || 'No preview'}</p>

        <div className="flex items-center gap-1 pt-2 mt-auto" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <button onClick={() => onEdit(tpl)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-50">
            <Edit size={11} /> Edit
          </button>
          <button onClick={() => onDuplicate(tpl)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-slate-400"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.background = 'rgba(59,130,246,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4E637A'; e.currentTarget.style.background = 'transparent' }}
            title="Duplicate"><Copy size={12} /></button>
          <button onClick={() => onDelete(tpl.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-slate-400"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4E637A'; e.currentTarget.style.background = 'transparent' }}
            title="Delete"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

export default function Templates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTpl, setEditTpl] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const dSearch = useDebounce(search)

  useEffect(() => { loadTemplates() }, [dSearch, category])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dSearch) params.search = dSearch
      if (category !== 'all') params.category = category
      const { data } = await templatesAPI.list(params)
      setTemplates(data)
    } catch { setTemplates([]) }
    finally { setLoading(false) }
  }

  const openAdd = () => { setEditTpl(null); setForm(EMPTY_FORM); setPreviewMode(false); setShowModal(true) }
  const openEdit = (t) => { setEditTpl(t); setForm({ ...t }); setPreviewMode(false); setShowModal(true) }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editTpl) { await templatesAPI.update(editTpl.id, form); toast.success('Template updated') }
      else { await templatesAPI.create(form); toast.success('Template created') }
      setShowModal(false); loadTemplates()
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await templatesAPI.delete(id); toast.success('Template deleted'); loadTemplates() }
    catch { toast.error('Delete failed') }
  }

  const handleDuplicate = async (tpl) => {
    try { await templatesAPI.create({ ...tpl, name: `${tpl.name} (copy)`, id: undefined }); toast.success('Duplicated'); loadTemplates() }
    catch { toast.error('Duplicate failed') }
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try { const { data } = await templatesAPI.seedDefaults(); toast.success(data.message); loadTemplates() }
    catch { toast.error('Seed failed') }
    finally { setSeeding(false) }
  }

  const catCounts = templates.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc }, {})

  return (
    <div>
      <Header
        title="Email Templates"
        subtitle={`${templates.length} templates`}
        action={<Btn variant="primary" size="sm" icon={Plus} onClick={openAdd}>New Template</Btn>}
      />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" className="w-full sm:w-64" />

          <div className="flex items-center gap-0.5 p-1 rounded-xl flex-wrap"
            style={{ background: '#F5F7FB', border: '1px solid rgba(0,0,0,0.08)' }}>
            {CATEGORIES.map((cat) => {
              const cnt = cat === 'all' ? templates.length : (catCounts[cat] || 0)
              const active = category === cat
              const cc = CAT_COLORS[cat]
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all capitalize whitespace-nowrap"
                  style={active
                    ? { background: cc ? cc.bg : 'rgba(59,130,246,0.12)', color: cc ? cc.text : '#3B82F6', border: `1px solid ${cc ? cc.border : 'rgba(59,130,246,0.25)'}` }
                    : { color: '#94A3B8', border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#94A3B8' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#4E637A' }}
                >
                  {cat}
                  {cnt > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={active
                        ? { background: cc ? cc.bg : 'rgba(59,130,246,0.2)', color: cc ? cc.text : '#3B82F6' }
                        : { background: 'rgba(0,0,0,0.08)', color: '#475569' }
                      }>{cnt}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <Btn variant="ghost" size="sm" icon={Sparkles} loading={seeding} onClick={handleSeedDefaults}>Starter Pack</Btn>
            <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={loadTemplates} />
          </div>
        </div>

        {/* Grid */}
        {loading ? <PageLoader /> : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Create reusable HTML email templates. Use {{variable}} placeholders for dynamic personalization."
            action={
              <div className="flex items-center gap-3">
                <Btn variant="secondary" size="md" icon={Sparkles} loading={seeding} onClick={handleSeedDefaults}>Load Starter Pack</Btn>
                <Btn variant="primary" size="md" icon={Plus} onClick={openAdd}>New Template</Btn>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} onEdit={openEdit} onDuplicate={handleDuplicate} onDelete={(id) => setDeleteId(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editTpl ? 'Edit Template' : 'New Template'}
        description={editTpl ? `Editing: ${editTpl.name}` : 'Create a reusable template with {{variables}}'}
        size="xl">
        <form onSubmit={handleSave}>
          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Template Name <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Welcome Email" className="input-base" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-base">
                {CATEGORIES.filter((c) => c !== 'all').map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Subject Line <span className="text-red-400">*</span></label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="{{headline}} — Don't miss this!" className="input-base" />
            </div>
          </div>

          {/* Variables */}
          <div className="mb-4 p-3 rounded-xl" style={{ background: '#F5F7FB', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Insert Variable</p>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button key={v} type="button"
                  onClick={() => setForm((f) => ({ ...f, html_content: f.html_content + v }))}
                  className="text-[11px] px-2 py-0.5 rounded font-mono transition-all"
                  style={{ background: '#F0F2F7', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F7FB'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)' }}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* Editor toggle */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">HTML Content</p>
            <button type="button" onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg transition-all"
              style={previewMode
                ? { color: '#3B82F6', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }
                : { color: '#475569', background: 'transparent', border: '1px solid transparent' }
              }
              onMouseEnter={(e) => { if (!previewMode) e.currentTarget.style.color = '#F8FAFC' }}
              onMouseLeave={(e) => { if (!previewMode) e.currentTarget.style.color = '#64748B' }}
            >
              {previewMode ? <><Code2 size={12} /> Code</> : <><Eye size={12} /> Preview</>}
            </button>
          </div>

          {previewMode ? (
            <div className="overflow-hidden mb-5 rounded-xl" style={{ border: '1px solid rgba(0,0,0,0.08)', height: 320, background: '#fff' }}>
              <iframe srcDoc={form.html_content} className="w-full h-full border-0" title="Preview" sandbox="allow-same-origin" />
            </div>
          ) : (
            <textarea
              value={form.html_content}
              onChange={(e) => setForm({ ...form, html_content: e.target.value })}
              rows={10}
              placeholder="<!DOCTYPE html>..."
              className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y mb-5 scrollbar-thin"
              style={{ background: '#F5F7FB', border: '1px solid rgba(0,0,0,0.10)', color: '#0F172A', outline: 'none', minHeight: 200 }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'}
            />
          )}

          <div className="flex gap-3">
            <Btn type="button" variant="secondary" size="md" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" size="md" className="flex-1" loading={saving}>
              {saving ? 'Saving…' : editTpl ? 'Save Changes' : 'Create Template'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { handleDelete(deleteId); setDeleteId(null) }}
        title="Delete Template"
        message="This will permanently delete the template." />
    </div>
  )
}
