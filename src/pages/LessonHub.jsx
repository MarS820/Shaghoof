import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'

const SEN_BADGES = [
  { key: 'dyslexia', icon: '👂', label: 'Dyslexia', ar: 'ديسكسيا', color: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  { key: 'adhd', icon: '⚡', label: 'ADHD', ar: 'فرط حركة', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  { key: 'esl', icon: '🌐', label: 'ESL', ar: 'لغة ثانية', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
]

const SUBJECT_GRADIENTS = [
  'linear-gradient(135deg, var(--energy-blue), var(--energy-cyan))',
  'linear-gradient(135deg, var(--energy-violet), var(--energy-pink))',
  'linear-gradient(135deg, var(--energy-orange), var(--energy-sunshine))',
  'linear-gradient(135deg, var(--energy-mint), var(--energy-cyan))',
  'linear-gradient(135deg, var(--energy-pink), var(--energy-violet))',
]

function activeBadges(user) {
  const flags = (user?.sen_flags || user?.conditions || []).map((f) => String(f).toLowerCase())
  const scores = user?.sen_scores || {}
  const badges = []
  SEN_BADGES.forEach((b) => {
    const flagged = flags.some((f) => f.includes(b.key))
    const scored = Number(scores[b.key] || 0) >= 1.5
    if (flagged || scored) badges.push(b)
  })
  return badges
}

export default function LessonHub() {
  const { user, lang } = useApp()
  const arabic = lang === 'ar'
  const navigate = useNavigate()
  const subjects = user?.subjects || []
  const sources = user?.dataSources || []
  const hasData = subjects.length > 0 || sources.length > 0

  const [selectedSubject, setSelectedSubject] = useState('')
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(false)
  const badges = activeBadges(user)

  useEffect(() => { loadLessons() }, [])

  const loadLessons = async () => {
    setLoading(true)
    try {
      const res = await api.listLessons(user.id)
      setLessons(res.lessons || [])
    } catch {
      setLessons([])
    } finally { setLoading(false) }
  }

  const openInTutor = (sessionId) => {
    navigate(`/tutor?lesson=${encodeURIComponent(sessionId)}`)
  }

  const filteredSources = selectedSubject ? sources.filter((s) => s.subject === selectedSubject) : sources
  const filteredLessons = selectedSubject ? lessons.filter((l) => l.subject === selectedSubject) : lessons

  if (!hasData) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <Mascot size={72} animate mood="waving" className="mx-auto mb-4 animate-bobble" />
        <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{arabic ? 'مقرراتي' : 'My Courses'}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">{arabic ? 'أضف موضوعات ومصادر في الإعدادات لتظهر مقرراتك هنا.' : 'Add subjects and data sources in Settings to see your courses here.'}</p>
        <Link to="/settings" className="brand-btn-primary mt-5">{arabic ? 'اذهب للإعدادات' : 'Go to Settings'}</Link>
      </div>
    )
  }

  return (
    <div className="sky-bg mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="animate-fade-in-up mb-6 flex items-center gap-3">
        <Mascot size={44} animate mood="teaching" />
        <div>
          <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{arabic ? 'مقرراتي' : 'My Courses'}</h1>
          <p className="text-sm font-semibold text-[var(--muted)]">{arabic ? 'موادك التعليمية مع الدعم المخصص' : 'Your learning materials with active accommodations'}</p>
          {badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b.key} className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${b.color}`} title={`${b.label} accommodations active on every lesson`}>
                  {b.icon} {arabic ? b.ar : b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {subjects.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => setSelectedSubject('')} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-bouncy ${!selectedSubject ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`}>{arabic ? 'الكل' : 'All subjects'}</button>
          {subjects.map((s) => (
            <button key={s.id} onClick={() => setSelectedSubject(s.name)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-bouncy ${selectedSubject === s.name ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`}>{s.name}</button>
          ))}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(selectedSubject ? subjects.filter((s) => s.name === selectedSubject) : subjects).map((s, idx) => {
          const subjectSources = filteredSources.filter((src) => src.subject === s.name)
          const subjectLessons = filteredLessons.filter((l) => l.subject === s.name)
          const progress = Math.min(95, 15 + subjectLessons.length * 12 + subjectSources.length * 4)
          const gradient = SUBJECT_GRADIENTS[idx % SUBJECT_GRADIENTS.length]
          const icon = s.icon || '📘'

          return (
            <div key={s.id} className="subject-card">
              <div className="subject-card-top" style={{ background: gradient }}>
                <div className="subject-card-top-icons">
                  <span className="text-3xl drop-shadow-md">{icon}</span>
                  <span className="subject-card-badge">{subjectLessons.length} {arabic ? 'درس' : 'lessons'}</span>
                </div>
                <div className="subject-card-cutout" />
              </div>
              <div className="subject-card-bottom">
                <h3 className="subject-card-title">{s.name}</h3>
                <div className="subject-card-stats">
                  <div className="subject-card-stat">
                    <span className="subject-card-stat-big">{subjectSources.length}</span>
                    <span className="subject-card-stat-label">{arabic ? 'مصدر' : 'Sources'}</span>
                  </div>
                  <div className="subject-card-stat-divider" />
                  <div className="subject-card-stat">
                    <span className="subject-card-stat-big">{subjectLessons.length}</span>
                    <span className="subject-card-stat-label">{arabic ? 'درس' : 'Lessons'}</span>
                  </div>
                  <div className="subject-card-stat-divider" />
                  <div className="subject-card-stat">
                    <span className="subject-card-stat-big">{progress}%</span>
                    <span className="subject-card-stat-label">{arabic ? 'التقدم' : 'Progress'}</span>
                  </div>
                </div>
                <div className="subject-card-progress">
                  <div className="subject-card-progress-fill" style={{ width: `${progress}%`, background: gradient }} />
                </div>
                <div className="subject-card-actions">
                  <Link to="/tutor" className="subject-card-btn-primary">{arabic ? 'ابدأ الدرس' : 'Start Lesson'}</Link>
                  <Link to="/exam" className="subject-card-btn-ghost">{arabic ? 'اختبار' : 'Quiz'}</Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
