import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748B]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base pl-9 pr-8"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8] transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
