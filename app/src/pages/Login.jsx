import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen auth-bg auth-grid flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 65%)' }} />

      <div className="relative w-full max-w-[400px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
            >
              <Zap size={18} className="text-white" />
            </div>
            <div className="leading-none text-left">
              <p className="text-slate-800 font-bold text-[14px] tracking-widest">KURO</p>
              <p className="text-[10px] font-semibold tracking-widest text-blue-500">FUNNELS</p>
            </div>
          </div>
          <h1 className="text-[24px] font-bold text-slate-800 leading-tight mb-1.5">Welcome back</h1>
          <p className="text-slate-500 text-sm">Sign in to your account to continue</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.09)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[12px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                Email address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  required
                  className="input-base pl-10"
                  style={{ height: 42 }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                  Password
                </label>
                <button type="button" className="text-[12px] text-blue-500 hover:text-blue-600 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••"
                  required
                  className="input-base pl-10 pr-10"
                  style={{ height: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-4 h-4 rounded border border-slate-300 flex items-center justify-center flex-shrink-0 bg-white" />
              <span className="text-[13px] text-slate-500">Remember me for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 font-semibold text-white py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.30)',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.45)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.30)' }}
            >
              {loading ? <LoadingSpinner size="sm" /> : <ArrowRight size={15} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[11px] text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <p className="text-center text-[13px] text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Enterprise email infrastructure platform
        </p>
      </div>
    </div>
  )
}
