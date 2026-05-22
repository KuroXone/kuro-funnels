import LoadingSpinner from './LoadingSpinner'

const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border border-blue-500/40 shadow-sm',
  secondary: 'bg-[#1B2A42] hover:bg-[#243350] text-[#94A3B8] hover:text-[#F8FAFC] border border-white/10 hover:border-white/16',
  ghost:     'hover:bg-white/5 text-[#64748B] hover:text-[#94A3B8] border border-transparent hover:border-white/8',
  danger:    'bg-red-500/12 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40',
  success:   'bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
  outline:   'border border-white/10 hover:border-blue-500/50 text-[#94A3B8] hover:text-white hover:bg-blue-500/8',
  purple:    'bg-violet-500/12 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20',
  warning:   'bg-amber-500/12 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20',
}

const SIZES = {
  xs: 'text-[11px] px-2.5 h-7 rounded-md gap-1.5',
  sm: 'text-xs px-3 h-8 rounded-lg gap-1.5',
  md: 'text-[13px] px-4 h-9 rounded-lg gap-2',
  lg: 'text-sm px-5 h-10 rounded-xl gap-2',
}

export default function Btn({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none whitespace-nowrap',
        VARIANTS[variant] || VARIANTS.secondary,
        SIZES[size] || SIZES.md,
        isDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {loading
        ? <LoadingSpinner size="sm" />
        : Icon
        ? <Icon size={size === 'xs' || size === 'sm' ? 12 : 14} />
        : null
      }
      {children}
      {!loading && IconRight && <IconRight size={size === 'xs' || size === 'sm' ? 12 : 14} />}
    </button>
  )
}
