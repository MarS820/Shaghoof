import { useEffect } from 'react'

export default function ModalOverlay({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto pt-16 pb-8 px-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl animate-bubble-in">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors text-lg" aria-label="Close">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
