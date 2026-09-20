import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Mascot from '../components/Mascot'
import api from '../services/api'

const STYLES = {
  visual: { en: 'Visual', ar: 'البصري', icon: '👁️', tip: { en: 'Describe what you would draw', ar: 'صِف ما سترسمه' } },
  auditory: { en: 'Auditory', ar: 'السمعي', icon: '🎧', tip: { en: 'Explain it as if telling a friend', ar: 'اشرحها وكأنك تحدّث صديقاً' } },
  reading: { en: 'Read/Write', ar: 'القرائي', icon: '📖', tip: { en: 'Write the key points in your words', ar: 'اكتب النقاط الأساسية بكلماتك' } },
  kinesthetic: { en: 'Kinesthetic', ar: 'الحركي', icon: '🖐️', tip: { en: 'Describe the steps as if doing it', ar: 'صِف الخطوات وكأنك تنفذها' } },
}

const KEYWORDS = {
  visual: ['diagram', 'chart', 'graph', 'draw', 'shape', 'sketch', 'visual', 'image', 'map', 'pattern'],
  auditory: ['hear', 'listen', 'sound', 'say', 'explain', 'rhythm', 'repeat', 'discuss', 'voice'],
  reading: ['define', 'list', 'note', 'write', 'summarize', 'term', 'meaning', 'text', 'words'],
  kinesthetic: ['step', 'do', 'practice', 'try', 'build', 'move', 'hands', 'perform', 'apply', 'act'],
}

const DISCLAIMER = {
  en: 'We grade effort, not perfection. Every attempt grows your weakest style.',
  ar: 'نُقيّم الجهد لا الكمال. كل محاولة تنمّي أسلوبك الأضعف.',
}

// Lenient keyword grading (master plan C2: check key concepts, not exact wording)
function growthScore(answer, style) {
  const text = String(answer || '').toLowerCase()
  if (!text.trim()) return 0
  const kws = KEYWORDS[style] || []
  const hits = kws.filter((k) => text.includes(k)).length
  const lengthBonus = Math.min(40, Math.floor(text.split(/\s+/).length * 2))
  const base = Math.min(60, hits * 20)
  return Math.min(100, base + lengthBonus)
}

export default function StretchZone() {
  const { user, lang, awardXp } = useApp()
  const [searchParams] = useSearchParams()
  const arabic = lang === 'ar'
  const [prompt, setPrompt] = useState(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [promptLoading, setPromptLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState(() => searchParams.get('subject') || '')

  const subjects = user?.subjects || []
  const sources = user?.dataSources || []

  const varkEntries = Object.entries(user?.vark || {}).filter(([k]) => STYLES[k] && Number.isFinite(Number(user.vark[k])))
  const weakest = varkEntries.length
    ? varkEntries.reduce((a, b) => (Number(a[1]) <= Number(b[1]) ? a : b))[0]
    : 'visual'

  useEffect(() => {
    if (!selectedSubject && subjects.length > 0) setSelectedSubject(subjects[0].name)
  }, [subjects])

  useEffect(() => {
    setPromptLoading(true)
    const subjectName = selectedSubject || subjects[0]?.name || 'General'
    const subjectSources = sources.filter((s) => s.subject === subjectName)
    const sourceContext = subjectSources.length > 0 ? subjectSources.map((s) => s.name).join(', ') : ''

    api.generateStretch({
      user_id: user.id,
      target_style: weakest,
      subject: subjectName,
      source_context: sourceContext || undefined,
    }).then((res) => {
      setPrompt(res?.prompt || res?.question || res?.text || null)
    }).catch(() => setPrompt(null)).finally(() => setPromptLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weakest, selectedSubject])

  const submit = async () => {
    if (!answer.trim()) return
    setLoading(true)
    const local = growthScore(answer, weakest)
    try {
      const res = await api.submitStretch({ user_id: user.id, style: weakest, answer })
      const server = Number(res?.growth_score ?? res?.score)
      const score = Number.isFinite(server) ? server : local
      setResult({ score, passed: score >= 60 })
      awardXp(Math.max(5, Math.round(score / 5)), arabic ? 'تحدي' : 'Stretch')
    } catch {
      setResult({ score: local, passed: local >= 60 })
      awardXp(Math.max(5, Math.round(local / 5)), arabic ? 'تحدي' : 'Stretch')
    } finally { setLoading(false) }
  }

  const style = STYLES[weakest]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="animate-fade-in-up mb-6 text-center">
        <Mascot size={60} animate mood="excited" className="mx-auto mb-3 animate-bobble" />
        <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🤸 {arabic ? 'منطقة التحدي' : 'Stretch Zone'}</h1>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{arabic ? DISCLAIMER.ar : DISCLAIMER.en}</p>
      </div>

      {/* Subject selector */}
      {subjects.length > 1 && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-extrabold text-[var(--ink)]">{arabic ? 'اختر المادة' : 'Choose a subject to stretch on'}</label>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button key={s.id || s.name} onClick={() => setSelectedSubject(s.name)} className={`rounded-full border-2 px-3 py-1.5 text-xs font-extrabold transition-bouncy ${selectedSubject === s.name ? 'text-white' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} style={selectedSubject === s.name ? { borderColor: 'var(--energy-violet)', background: 'var(--energy-violet)' } : {}}>
                {s.name}
              </button>
            ))}
          </div>
          {selectedSubject && sources.filter((s) => s.subject === selectedSubject).length > 0 && (
            <p className="mt-1.5 text-[10px] font-semibold text-[var(--muted)]">
              {arabic ? 'مصادر متاحة: ' : 'Sources: '}{sources.filter((s) => s.subject === selectedSubject).map((s) => s.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Weakest style hero */}
      <div className="animate-bubble-in mb-5 rounded-3xl border-2 border-dashed p-5 text-center" style={{ borderColor: 'var(--energy-violet)', background: 'color-mix(in srgb, var(--energy-violet) 8%, transparent)' }}>
        <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--energy-violet)' }}>{arabic ? 'أسلوبك الأضعف اليوم' : "Today's weakest style"}</p>
        <p className="mt-1 text-2xl font-extrabold dark:text-purple-300" style={{ color: 'var(--energy-violet)' }}>{style.icon} {arabic ? style.ar : style.en}</p>
        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--energy-violet)' }}>{arabic ? style.tip.ar : style.tip.en}</p>
      </div>

      {promptLoading && <div className="shimmer mb-4 h-24 rounded-2xl" />}

      {prompt && (
        <div className="bubble-card mb-4 p-5">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{arabic ? 'مهمة التحدي' : 'Stretch task'}</p>
          <p className="text-sm font-bold leading-relaxed text-[var(--ink)]">{prompt}</p>
        </div>
      )}

      <div className="bubble-card p-5">
        <label className="mb-2 block text-xs font-extrabold text-[var(--ink)]">{arabic ? 'إجابتك (صوت أو كتابة — الأفكار أهم من الإملاء)' : 'Your answer (voice or text — ideas matter, not spelling)'}</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={5}
          placeholder={arabic ? 'اكتب بحرية... لا تقلق من الأخطاء 🌱' : 'Write freely... no worry about mistakes 🌱'}
          className="brand-textarea"
        />
        <button onClick={submit} disabled={!answer.trim() || loading} className="brand-btn-primary mt-3 w-full">
          {loading ? (arabic ? 'جارٍ التقييم...' : 'Grading...') : (arabic ? 'أرسل محاولتي' : 'Submit my attempt')}
        </button>
        {!prompt && !promptLoading && (
          <p className="mt-2 text-center text-[10px] font-bold text-[var(--muted)]">
            {arabic ? '(تعذر تحميل مهمة من الخادم — اكتب تحدياً لنفسك!)' : '(Server task unavailable — challenge yourself with your own!)'}
          </p>
        )}
        <p className="mt-2 text-center text-[10px] font-semibold text-[var(--muted)]">{arabic ? 'إملاءك لا يُحسب ضدك — نقّح الأفكار فقط.' : 'Spelling is never counted against you — only ideas.'}</p>
      </div>

      {result && (
        <div className={`animate-bubble-in mt-4 rounded-3xl border-2 p-5 text-center ${result.passed ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30' : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'}`}>
          <p className="text-3xl">{result.passed ? '🎉' : '🌱'}</p>
          <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">
            {arabic ? 'إتقان' : 'Mastery'}: {result.score}% · {arabic ? 'نمو' : 'Growth'}: {Math.min(100, result.score + 15)}%
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--muted)]">
            {result.passed
              ? (arabic ? 'محاولة عظيمة! عجلة دماغك تنمو 🧠✨' : 'Great attempt! Your Brain Wheel is growing 🧠✨')
              : (arabic ? 'محاولة رائعة! كل محاولة تنمّي دماغك 🌱' : 'Great try! Every attempt helps your brain grow 🌱')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => { setResult(null); setAnswer('') }} className="brand-btn-secondary text-xs">{arabic ? 'حاول مرة أخرى' : 'Try again'}</button>
            <Link to="/dashboard" className="brand-btn-ghost text-xs">{arabic ? 'شاهد عجلتك' : 'See my wheel'}</Link>
          </div>
        </div>
      )}
    </div>
  )
}
