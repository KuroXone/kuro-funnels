import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import LoadingSpinner from '../components/LoadingSpinner'

const PERKS = [
  'SMTP rotation & warmup',
  'Campaign analytics & tracking',
  'Domain DNS management',
  'Advanced queue monitoring',
]

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm_password: '', full_name: '' })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match')
    if (!agreedToTerms) return toast.error('You must agree to the Terms of Service')
    setLoading(true)
    try {
      const { confirm_password, ...payload } = form
      await register(payload)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail.map((d) => d.msg).join(', '))
      } else {
        toast.error(detail || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen auth-bg auth-grid flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 65%)' }} />

      <div className="relative w-full max-w-[420px]">
        {/* Brand */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2.5 mb-4">
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
          <h1 className="text-[24px] font-bold text-slate-800 leading-tight mb-1.5">Create your account</h1>
          <p className="text-slate-500 text-sm">Start sending smarter emails today</p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PERKS.map((perk) => (
            <div key={perk} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-100">
                <Check size={9} className="text-emerald-600" />
              </div>
              <span className="text-[11px] text-slate-500">{perk}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.09)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Full Name</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Jane Doe"
                    className="input-base pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="janedoe"
                    required
                    className="input-base pl-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  required
                  className="input-base pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  className="input-base pl-9 pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: form.password.length >= 12 ? '100%' : form.password.length >= 8 ? '60%' : '30%',
                        background: form.password.length >= 12 ? '#10B981' : form.password.length >= 8 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px]"
                    style={{ color: form.password.length >= 12 ? '#10B981' : form.password.length >= 8 ? '#F59E0B' : '#EF4444' }}>
                    {form.password.length >= 12 ? 'Strong' : form.password.length >= 8 ? 'Good' : 'Weak'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  placeholder="Repeat your password"
                  required
                  className="input-base pl-9 pr-10"
                  style={{
                    borderColor: form.confirm_password && form.confirm_password !== form.password
                      ? '#FCA5A5' : undefined,
                  }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {form.confirm_password && form.confirm_password !== form.password && (
                <p className="text-[10px] text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 accent-blue-500 w-4 h-4 flex-shrink-0"
              />
              <span className="text-[12px] text-slate-500">
                I agree to the{' '}
                <a href="#" className="text-blue-500 hover:text-blue-600 transition-colors">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-blue-500 hover:text-blue-600 transition-colors">Privacy Policy</a>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 font-semibold text-white py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 mt-2"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.30)',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.45)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.30)' }}
            >
              {loading ? <LoadingSpinner size="sm" /> : <ArrowRight size={15} />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[11px] text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <p className="text-center text-[13px] text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          By creating an account, you agree to our terms of service
        </p>
      </div>
    </div>
  )
}
