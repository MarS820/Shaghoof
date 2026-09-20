import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'

export default function NotificationBell() {
  const { user, lang } = useApp()
  const arabic = lang === 'ar'
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const fetchRecommendations = async () => {
    if (!user?.id || data) return
    setLoading(true)
    try {
      const res = await api.getInsights(user.id)
      setData(res)
    } catch { /* offline-safe */ }
    finally { setLoading(false) }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) fetchRecommendations()
  }

  const weakTopics = data?.weak_topics || []
  const strongTopics = data?.strong_topics || []
  const recommendations = data?.recommendations || []
  const count = weakTopics.length + recommendations.length

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="capsule-iconbtn relative" aria-label={arabic ? 'التوصيات' : 'Recommendations'} aria-expanded={open}>
        🔔
        {count > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--energy-pink)] px-1 text-[8px] font-extrabold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-4 space-y-3" style={{ backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>💡 {arabic ? 'توصيات لك' : 'Recommendations'}</h3>
            <button onClick={() => setOpen(false)} className="text-[var(--muted)] hover:text-[var(--ink)] text-lg leading-none">✕</button>
          </div>

          {loading && <p className="text-xs text-[var(--muted)] text-center py-4">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</p>}

          {!loading && count === 0 && recommendations.length === 0 && (
            <p className="text-xs text-[var(--muted)] text-center py-4">{arabic ? 'لا توجد توصيات حالياً' : 'No recommendations yet'}</p>
          )}

          {weakTopics.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{arabic ? 'مواضع ضعيفة' : 'Weak topics'}</p>
              <div className="flex flex-wrap gap-1.5">
                {weakTopics.map((t, i) => <span key={`w-${i}`} className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">🎯 {t}</span>)}
              </div>
            </div>
          )}

          {strongTopics.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{arabic ? 'مواضع قوية' : 'Strong topics'}</p>
              <div className="flex flex-wrap gap-1.5">
                {strongTopics.map((t, i) => <span key={`s-${i}`} className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-600 dark:bg-green-950/40 dark:text-green-300">🏆 {t}</span>)}
              </div>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{arabic ? 'اقتراحات' : 'Suggestions'}</p>
              <ul className="space-y-2">
                {recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-semibold leading-snug text-[var(--muted)]">
                    <span className="mt-0.5 text-[var(--brand)]">•</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
