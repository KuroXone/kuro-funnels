import LoadingSpinner from './LoadingSpinner'

const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border border-blue-600/80 shadow-sm',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm',
  ghost:     'hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-transparent hover:border-slate-200',
  danger:    'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300',
  success:   'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200',
  outline:   'border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 hover:bg-blue-50',
  purple:    'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200',
  warning:   'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200',
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
