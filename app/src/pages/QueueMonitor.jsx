import { useEffect, useState } from 'react'
import { RefreshCw, RotateCcw, ListTodo, Wifi, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import { PageLoader } from '../components/LoadingSpinner'
import LoadingSpinner from '../components/LoadingSpinner'
import useAppStore from '../store/appStore'
import useDebounce from '../hooks/useDebounce'
import { queueAPI } from '../services/api'

const STATUS_LIST = ['pending', 'processing', 'sent', 'failed', 'retry']

const STAT_STYLES = {
  pending:    { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  processing: { bar: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'     },
  sent:       { bar: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50 border-green-200'   },
  failed:     { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200'       },
  retry:      { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
}

export default function QueueMonitor() {
  const { queueStats, fetchQueueStats } = useAppStore()
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 50
  const dSearch = useDebounce(search)

  // Live polling every 4 seconds
  useEffect(() => {
    fetchQueueStats()
    const interval = setInterval(fetchQueueStats, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadItems()
  }, [statusFilter, dSearch, page])

  const loadItems = async () => {
    setItemsLoading(true)
    try {
      const params = { skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }
      if (statusFilter) params.status = statusFilter
      const { data } = await queueAPI.items(params)
      setItems(Array.isArray(data) ? data : [])
      setTotal(Array.isArray(data) ? data.length : 0)
    } catch { setItems([]) }
    finally { setItemsLoading(false) }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const { data } = await queueAPI.retryFailed()
      toast.success(`${data.queued} failed emails re-queued`)
      fetchQueueStats()
      loadItems()
    } catch { toast.error('Retry failed') }
    finally { setRetrying(false) }
  }

  const stats = queueStats || {}
  const totalAll = Object.values(stats).reduce((a, b) => a + b, 0)
  const maxVal = Math.max(1, ...Object.values(stats))

  return (
    <div>
      <Header title="Queue Monitor" />
      <div className="p-6 space-y-5">

        {/* Live stat cards with mini bar charts */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STATUS_LIST.map((s) => {
            const val = stats[s] || 0
            const styles = STAT_STYLES[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`p-4 rounded-xl border transition-all text-left ${statusFilter === s ? `${styles.bg} border-opacity-60` : 'bg-white border-slate-200 hover:border-slate-200'}`}
              >
                <div className={`text-2xl font-bold mb-1 ${styles.text}`}>{val.toLocaleString()}</div>
                <div className="text-xs text-slate-500 capitalize mb-2">{s}</div>
                <div className="w-full bg-slate-100 rounded-full h-1">
                  <div className={`h-1 rounded-full transition-all duration-500 ${styles.bar}`} style={{ width: `${(val / maxVal) * 100}%` }} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-sm">{totalAll.toLocaleString()} total</span>
            {statusFilter && (
              <button onClick={() => setStatusFilter('')} className="text-xs text-violet-400 hover:underline">
                Clear filter
              </button>
            )}
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              disabled={retrying || !stats.failed}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-sm transition-all disabled:opacity-40"
            >
              {retrying ? <LoadingSpinner size="sm" /> : <RotateCcw size={13} />}
              Retry Failed ({stats.failed || 0})
            </button>
            <button onClick={loadItems} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition-all">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {itemsLoading ? <PageLoader /> : items.length === 0 ? (
            <EmptyState icon={ListTodo} title="No queue items" description={statusFilter ? `No items with status "${statusFilter}"` : 'The queue is empty'} />
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['ID', 'Campaign', 'Status', 'Retries', 'Created', 'Processed', 'Error'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">#{item.id}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">#{item.campaign_id}</td>
                      <td className="px-4 py-3"><Badge status={item.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{item.retry_count}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{item.processed_at ? new Date(item.processed_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">{item.error_message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
