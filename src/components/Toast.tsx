import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'

export function Toast() {
  const toast = useStore(s => s.toast)
  const clearToast = useStore(s => s.clearToast)

  const colors = {
    success: 'var(--accent)',
    error: 'var(--red-flag)',
    info: 'var(--info)',
  }

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key="toast"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={clearToast}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: 'var(--toast-bg)',
            border: `1px solid ${colors[toast.type]}`,
            borderLeft: `3px solid ${colors[toast.type]}`,
            color: '#F2F1ED',
            padding: '10px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            maxWidth: 360,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
