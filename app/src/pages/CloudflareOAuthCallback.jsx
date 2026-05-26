import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Cloud, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cloudflareOAuthAPI } from '../services/api'

export default function CloudflareOAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing') // processing | success | error
  const [message, setMessage] = useState('')
  const [accountName, setAccountName] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')

    if (error) {
      setStatus('error')
      setMessage(errorDesc || `Cloudflare denied access: ${error}`)
      return
    }

    if (!code || !state) {
      setStatus('error')
      setMessage('Missing OAuth parameters. Please try connecting again.')
      return
    }

    // Exchange code for tokens
    cloudflareOAuthAPI.callback(code, state)
      .then(({ data }) => {
        setStatus('success')
        setAccountName(data.account_name || 'Cloudflare Account')
        setMessage(data.message || 'Connected successfully!')
        // Redirect back to domain manager after 2 seconds
        setTimeout(() => navigate('/domains', { replace: true }), 2000)
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || 'Failed to connect Cloudflare account'
        setStatus('error')
        setMessage(detail)
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center">

        {/* CF logo */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
          status === 'success' ? 'bg-emerald-50 border border-emerald-200'
          : status === 'error' ? 'bg-red-50 border border-red-200'
          : 'bg-blue-50 border border-blue-200'
        }`}>
          {status === 'processing' && <Loader2 size={28} className="text-blue-500 animate-spin" />}
          {status === 'success' && <CheckCircle size={28} className="text-emerald-500" />}
          {status === 'error' && <XCircle size={28} className="text-red-500" />}
        </div>

        {status === 'processing' && (
          <>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Connecting Cloudflare…</h1>
            <p className="text-slate-500 text-sm">Exchanging tokens and verifying your account</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Cloudflare Connected!</h1>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Cloud size={14} className="text-blue-500" />
              <p className="text-blue-600 font-semibold text-sm">{accountName}</p>
            </div>
            <p className="text-slate-500 text-sm mb-6">{message}</p>
            <p className="text-slate-400 text-xs">Redirecting to Domain Manager…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Connection Failed</h1>
            <p className="text-red-500 text-sm mb-6">{message}</p>
            <button
              onClick={() => navigate('/domains', { replace: true })}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all"
            >
              Back to Domain Manager
            </button>
          </>
        )}
      </div>
    </div>
  )
}
