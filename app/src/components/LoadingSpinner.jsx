export default function LoadingSpinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4 border-2', md: 'w-5 h-5 border-2', lg: 'w-8 h-8 border-[3px]' }
  return (
    <div className={`${s[size]} border-white/10 border-t-blue-500 rounded-full animate-spin flex-shrink-0 ${className}`} />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-56">
      <LoadingSpinner size="lg" />
    </div>
  )
}
