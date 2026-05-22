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
      {/* Background orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)' }} />

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
              <p className="text-white font-bold text-[14px] tracking-widest">KURO</p>
              <p className="text-[10px] font-semibold tracking-widest" style={{ color: '#3B82F6' }}>FUNNELS</p>
            </div>
          </div>
          <h1 className="text-[24px] font-bold text-white leading-tight mb-1.5">Welcome back</h1>
          <p className="text-[#64748B] text-sm">Sign in to your account to continue</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#162033',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[12px] font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">
                Email address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4E637A]" />
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[12px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                  Password
                </label>
                <button type="button" className="text-[12px] text-[#3B82F6] hover:text-blue-400 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4E637A]" />
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4E637A] hover:text-[#94A3B8] transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
              </div>
              <span className="text-[13px] text-[#64748B]">Remember me for 30 days</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 font-semibold text-white py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
              style={{
                background: loading ? '#2563EB' : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)' }}
            >
              {loading ? <LoadingSpinner size="sm" /> : <ArrowRight size={15} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[11px] text-[#4E637A]">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <p className="text-center text-[13px] text-[#64748B]">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#2A3A54] mt-6">
          Enterprise email infrastructure platform
        </p>
      </div>
    </div>
  )
}
