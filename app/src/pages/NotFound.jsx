import { Link } from 'react-router-dom'
import { Home, Zap } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <p className="text-[120px] font-black text-gray-900 leading-none select-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center">
              <Zap size={28} className="text-white" />
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
        >
          <Home size={16} /> Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
