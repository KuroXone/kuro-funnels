import { useEffect, useState } from 'react'
import { Plus, Upload, Trash2, Users, FolderPlus, ChevronRight } from 'lucide-react'
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
import LoadingSpinner from '../components/LoadingSpinner'
import useAppStore from '../store/appStore'
import useDebounce from '../hooks/useDebounce'
import { contactsAPI } from '../services/api'

const PAGE_SIZE = 50

const BORDER = '1px solid rgba(255,255,255,0.07)'

export default function Contacts() {
  const { contactLists, contactListsLoading, fetchContactLists } = useAppStore()
  const [selectedList, setSelectedList] = useState(null)
  const [contacts, setContacts] = useState([])
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [contactSearch, setContactSearch] = useState('')
  const dSearch = useDebounce(contactSearch)

  const [showListModal, setShowListModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [listForm, setListForm] = useState({ name: '', description: '' })
  const [contactForm, setContactForm] = useState({ email: '', first_name: '', last_name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [deleteListId, setDeleteListId] = useState(null)
  const [deleteContactId, setDeleteContactId] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => { fetchContactLists() }, [])

  useEffect(() => {
    if (selectedList) { setPage(1); loadContacts(selectedList, 1) }
  }, [dSearch])

  useEffect(() => {
    if (selectedList) loadContacts(selectedList, page)
  }, [page])

  const loadContacts = async (list, p = 1) => {
    setContactsLoading(true)
    try {
      const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
      if (dSearch) params.search = dSearch
      const { data } = await contactsAPI.contacts(list.id, params)
      if (data && typeof data === 'object' && 'items' in data) {
        setContacts(data.items); setContactsTotal(data.total)
      } else {
        const arr = Array.isArray(data) ? data : []
        setContacts(arr); setContactsTotal(arr.length)
      }
    } catch { setContacts([]); setContactsTotal(0) }
    finally { setContactsLoading(false) }
  }

  const selectList = (list) => {
    setSelectedList(list); setPage(1); setContactSearch(''); loadContacts(list, 1)
  }

  const createList = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await contactsAPI.createList(listForm)
      toast.success('List created'); setShowListModal(false); setListForm({ name: '', description: '' }); fetchContactLists()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const addContact = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await contactsAPI.addContact(selectedList.id, contactForm)
      toast.success('Contact added'); setShowContactModal(false)
      setContactForm({ email: '', first_name: '', last_name: '', phone: '' })
      loadContacts(selectedList, page); fetchContactLists()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedList) return
    setImporting(true)
    try {
      const { data } = await contactsAPI.importCSV(selectedList.id, file)
      toast.success(`Imported ${data.imported} contacts (${data.skipped} skipped)`)
      loadContacts(selectedList, 1); setPage(1); fetchContactLists()
    } catch { toast.error('Import failed') }
    finally { setImporting(false); e.target.value = '' }
  }

  const handleDeleteList = async (id) => {
    try {
      await contactsAPI.deleteList(id); toast.success('List deleted')
      if (selectedList?.id === id) { setSelectedList(null); setContacts([]); setContactsTotal(0) }
      fetchContactLists()
    } catch { toast.error('Delete failed') }
  }

  const handleDeleteContact = async (cid) => {
    try {
      await contactsAPI.deleteContact(selectedList.id, cid); toast.success('Contact removed')
      loadContacts(selectedList, page); fetchContactLists()
    } catch { toast.error('Delete failed') }
  }

  return (
    <div>
      <Header
        title="Contacts"
        subtitle={`${contactLists.reduce((s, l) => s + (l.contact_count || 0), 0).toLocaleString()} total`}
        action={
          <Btn variant="primary" size="sm" icon={FolderPlus} onClick={() => setShowListModal(true)}>
            New List
          </Btn>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Lists panel */}
          <div className="lg:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4E637A] mb-3">Lists</p>
            {contactListsLoading ? <PageLoader /> : contactLists.length === 0 ? (
              <EmptyState icon={Users} title="No lists yet"
                description="Create a contact list to organize your recipients"
                action={<Btn variant="primary" size="sm" icon={Plus} onClick={() => setShowListModal(true)}>Create List</Btn>}
              />
            ) : (
              <div className="space-y-1.5">
                {contactLists.map((list) => {
                  const active = selectedList?.id === list.id
                  return (
                    <div
                      key={list.id}
                      onClick={() => selectList(list)}
                      className="flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: active ? 'rgba(59,130,246,0.1)' : '#162033',
                        border: active ? '1px solid rgba(59,130,246,0.25)' : BORDER,
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                            border: active ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <Users size={13} style={{ color: active ? '#3B82F6' : '#64748B' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: active ? '#F8FAFC' : '#94A3B8' }}>
                            {list.name}
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            {(list.contact_count || 0).toLocaleString()} contacts
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteListId(list.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#4E637A] hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={13} style={{ color: active ? '#3B82F6' : '#4E637A' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Contacts panel */}
          <div className="lg:col-span-2">
            {selectedList ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h2 className="text-[#F8FAFC] font-semibold text-[14px]">{selectedList.name}</h2>
                    <p className="text-[#64748B] text-xs mt-0.5">{contactsTotal.toLocaleString()} contacts</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SearchInput value={contactSearch} onChange={setContactSearch} placeholder="Search…" className="w-44" />
                    <label
                      className={`flex items-center gap-1.5 cursor-pointer px-3 h-9 rounded-lg text-[13px] font-medium transition-all ${importing ? 'opacity-50' : ''}`}
                      style={{ background: '#1B2A42', border: BORDER, color: '#94A3B8' }}
                      onMouseEnter={(e) => { if (!importing) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                    >
                      {importing ? <LoadingSpinner size="sm" /> : <Upload size={13} />}
                      Import CSV
                      <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={importing} />
                    </label>
                    <Btn variant="primary" size="sm" icon={Plus} onClick={() => setShowContactModal(true)}>
                      Add Contact
                    </Btn>
                  </div>
                </div>

                {contactsLoading ? <PageLoader /> : contacts.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={dSearch ? 'No contacts match your search' : 'No contacts yet'}
                    description={dSearch ? 'Try a different search term' : 'Add contacts manually or import a CSV file'}
                  />
                ) : (
                  <div className="tbl-wrap">
                    <table className="w-full">
                      <thead className="tbl-head">
                        <tr>
                          {['Email', 'Name', 'Status', ''].map((h) => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((c) => (
                          <tr key={c.id} className="tbl-row">
                            <td className="text-[#F8FAFC] text-[13px]">{c.email}</td>
                            <td className="text-[#94A3B8] text-[13px]">
                              {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td>
                              <Badge
                                status={c.is_bounced ? 'error' : c.is_subscribed ? 'active' : 'paused'}
                                label={c.is_bounced ? 'Bounced' : c.is_subscribed ? 'Subscribed' : 'Unsubscribed'}
                              />
                            </td>
                            <td className="text-right">
                              <button
                                onClick={() => setDeleteContactId(c.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg ml-auto text-[#4E637A] hover:text-red-400 hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      page={page} total={contactsTotal} pageSize={PAGE_SIZE}
                      onChange={(p) => { setPage(p); loadContacts(selectedList, p) }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(255,255,255,0.05)', border: BORDER }}>
                  <Users size={22} className="text-[#4E637A]" />
                </div>
                <p className="text-[#94A3B8] font-semibold text-[14px]">Select a list</p>
                <p className="text-[#4E637A] text-sm mt-1">Choose a contact list from the left panel</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create list modal */}
      <Modal isOpen={showListModal} onClose={() => setShowListModal(false)} title="Create Contact List" size="sm">
        <form onSubmit={createList} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wide">List Name <span className="text-red-400">*</span></label>
            <input value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} required placeholder="Newsletter Subscribers" className="input-base" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wide">Description</label>
            <input value={listForm.description} onChange={(e) => setListForm({ ...listForm, description: e.target.value })} placeholder="Optional description" className="input-base" />
          </div>
          <div className="flex gap-3 pt-1">
            <Btn type="button" variant="secondary" size="md" className="flex-1" onClick={() => setShowListModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" size="md" className="flex-1" loading={saving}>Create</Btn>
          </div>
        </form>
      </Modal>

      {/* Add contact modal */}
      <Modal isOpen={showContactModal} onClose={() => setShowContactModal(false)} title="Add Contact" size="sm">
        <form onSubmit={addContact} className="space-y-4">
          {[
            ['Email',      'email',      'email', 'contact@example.com', true],
            ['First Name', 'first_name', 'text',  'Jane',                false],
            ['Last Name',  'last_name',  'text',  'Doe',                 false],
            ['Phone',      'phone',      'tel',   '+1234567890',         false],
          ].map(([label, name, type, placeholder, req]) => (
            <div key={name}>
              <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wide">
                {label} {req && <span className="text-red-400">*</span>}
              </label>
              <input
                type={type}
                value={contactForm[name]}
                onChange={(e) => setContactForm({ ...contactForm, [name]: e.target.value })}
                required={req}
                placeholder={placeholder}
                className="input-base"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <Btn type="button" variant="secondary" size="md" className="flex-1" onClick={() => setShowContactModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" size="md" className="flex-1" loading={saving}>Add Contact</Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteListId} onClose={() => setDeleteListId(null)} onConfirm={() => handleDeleteList(deleteListId)} title="Delete List" message="This will permanently delete the list and all its contacts." />
      <ConfirmDialog isOpen={!!deleteContactId} onClose={() => setDeleteContactId(null)} onConfirm={() => handleDeleteContact(deleteContactId)} title="Remove Contact" message="This will remove the contact from the list." />
    </div>
  )
}
