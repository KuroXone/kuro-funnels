import { X } from 'lucide-react'
import { useEffect } from 'react'

const SIZES = {
  sm:  'max-w-md',
  md:  'max-w-lg',
  lg:  'max-w-2xl',
  xl:  'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', description }) {
  useEffect(() => {
    if (!isOpen) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className={`relative w-full ${SIZES[size] || SIZES.md} modal-content`}>
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.10)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div>
              <h2 className="text-slate-800 font-semibold text-[15px] leading-none">{title}</h2>
              {description && <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all ml-3 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
          {/* Body */}
          <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-thin">{children}</div>
        </div>
      </div>
    </div>
  )
}
