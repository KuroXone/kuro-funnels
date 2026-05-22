import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'
import Btn from './Btn'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, danger = true }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center">
        <div
          className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: danger ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
            border: danger ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <AlertTriangle size={20} style={{ color: danger ? '#EF4444' : '#F59E0B' }} />
        </div>
        <h3 className="text-[#F8FAFC] font-semibold text-[15px] mb-2">{title}</h3>
        <p className="text-[#64748B] text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <Btn variant="secondary" size="md" className="flex-1" onClick={onClose}>Cancel</Btn>
          <Btn
            variant={danger ? 'danger' : 'warning'}
            size="md"
            className="flex-1"
            onClick={() => { onConfirm(); onClose() }}
          >
            {danger ? 'Delete' : 'Confirm'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
