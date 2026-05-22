export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Icon size={20} className="text-[#64748B]" />
        </div>
      )}
      <p className="text-[#F8FAFC] font-semibold text-[15px] mb-1.5">{title}</p>
      {description && (
        <p className="text-[13px] text-[#64748B] max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
