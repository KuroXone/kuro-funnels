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
  const [form, setForm] = useState({ email: '', username: '', password: '', full_name: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await register(form)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen auth-bg auth-grid flex items-center justify-center p-4 relative overflow-hidden">
      {/* Orbs */}
      <div className="absolute top-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 65%)' }} />

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
              <p className="text-white font-bold text-[14px] tracking-widest">KURO</p>
              <p className="text-[10px] font-semibold tracking-widest" style={{ color: '#3B82F6' }}>FUNNELS</p>
            </div>
          </div>
          <h1 className="text-[24px] font-bold text-white leading-tight mb-1.5">Create your account</h1>
          <p className="text-[#64748B] text-sm">Start sending smarter emails today</p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PERKS.map((perk) => (
            <div key={perk} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Check size={9} className="text-emerald-400" />
              </div>
              <span className="text-[11px] text-[#64748B]">{perk}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background: '#162033',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1.5 uppercase tracking-wide">Full Name</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4E637A]" />
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
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1.5 uppercase tracking-wide">Username <span className="text-red-400">*</span></label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4E637A]" />
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

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1.5 uppercase tracking-wide">Email <span className="text-red-400">*</span></label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4E637A]" />
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

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1.5 uppercase tracking-wide">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4E637A]" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  className="input-base pl-9 pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4E637A] hover:text-[#94A3B8] transition-colors">
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 font-semibold text-white py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 mt-2"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)' }}
            >
              {loading ? <LoadingSpinner size="sm" /> : <ArrowRight size={15} />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[11px] text-[#4E637A]">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <p className="text-center text-[13px] text-[#64748B]">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-[#2A3A54] mt-5">
          By creating an account, you agree to our terms of service
        </p>
      </div>
    </div>
  )
}
