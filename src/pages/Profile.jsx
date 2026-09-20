import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Mascot from '../components/Mascot'
import BrainWheel from '../components/BrainWheel'
import TemplateRevealPopup from '../components/TemplateRevealPopup'
import { BADGE_TIERS, getCurrentBadge, getNextBadge } from '../constants/badges'
import api from '../services/api'

const VARK_COPY = {
  visual: { en: 'Visual', ar: 'بصري', icon: '👁️', color: '#3b82f6', desc: { en: 'Diagrams, charts, and visual maps', ar: 'الرسوم والمخططات والخرائط البصرية' } },
  auditory: { en: 'Auditory', ar: 'سمعي', icon: '🎧', color: '#8b5cf6', desc: { en: 'Listening, discussion, podcasts', ar: 'الاستماع والنقاش والبودكاست' } },
  reading: { en: 'Read/Write', ar: 'قرائي', icon: '📖', color: '#10b981', desc: { en: 'Notes, lists, written text', ar: 'الملاحظات والقوائم والنصوص' } },
  kinesthetic: { en: 'Kinesthetic', ar: 'حركي', icon: '🖐️', color: '#f97316', desc: { en: 'Hands-on practice and activities', ar: 'التجريب العملي والأنشطة' } },
}

const SEN_COPY = {
  dyslexia: { icon: '👂', label: 'Dyslexia support', ar: 'دعم الديسكسيا' },
  adhd: { icon: '⚡', label: 'ADHD support', ar: 'دعم فرط الحركة' },
  esl: { icon: '🌐', label: 'ESL support', ar: 'دعم اللغة الثانية' },
  asd: { icon: '🧩', label: 'ASD support', ar: 'دعم طيف التوحد' },
  slcn: { icon: '💬', label: 'SLCN support', ar: 'دعم النطق واللغة' },
  semh: { icon: '💚', label: 'SEMH support', ar: 'دعم الصحة النفسية' },
}

const SUITE_TOGGLES = [
  { key: 'dyslexicFont', icon: '🔤', en: 'OpenDyslexic font', ar: 'خط OpenDyslexic', desc: { en: 'Easier letter shapes for reading', ar: 'أشكال حروف أسهل للقراءة' } },
  { key: 'lineFocus', icon: '📏', en: 'Line focus ruler', ar: 'مسطرة التركيز', desc: { en: 'Highlights one line at a time', ar: 'يُبرز سطراً واحداً في كل مرة' } },
  { key: 'voiceReader', icon: '🔊', en: 'Text-to-speech ready', ar: 'النطق الصوتي', desc: { en: 'Listen buttons on all text', ar: 'أزرار استماع على كل نص' } },
  { key: 'zenMode', icon: '🧘', en: 'Zen mode', ar: 'وضع التأمل', desc: { en: 'Distraction-free reading', ar: 'قراءة بلا تشتيت' } },
  { key: 'whiteNoise', icon: '🎧', en: 'White noise', ar: 'ضوضاء بيضاء', desc: { en: 'Ambient focus sound (bottom-left control)', ar: 'صوت محيط للتركيز (أسفل اليسار)' } },
  { key: 'sensoryCalm', icon: '🌿', en: 'Low sensory load', ar: 'حمل حسي منخفض', desc: { en: 'Calms animations and colors', ar: 'يهدئ الحركات والألوان' } },
  { key: 'largeText', icon: '🔠', en: 'Larger text', ar: 'نص أكبر', desc: { en: 'Bigger base font size', ar: 'حجم خط أكبر' } },
  { key: 'highContrast', icon: '◐', en: 'High contrast', ar: 'تباين عالٍ', desc: { en: 'Stronger color separation', ar: 'فصل ألوان أقوى' } },
]

export default function Profile() {
  const { user, lang, toggles, setToggles, xpEffective } = useApp()
  const arabic = lang === 'ar'
  const [brainwheel, setBrainwheel] = useState(null)
  const [showReveal, setShowReveal] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    api.brainwheel(user.id).then(setBrainwheel).catch(() => setBrainwheel(null))
  }, [user?.id, user?.vark])

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />

  const vark = user?.vark || {}
  const entries = Object.entries(vark).filter(([k]) => VARK_COPY[k] && Number.isFinite(Number(vark[k])))
  const flags = (user.sen_flags || user.conditions || [])
  const displayXp = xpEffective
  const profileLevel = Math.max(1, Math.floor(displayXp / 500) + 1)
  const intoLevel = displayXp % 500

  const badgeTiers = BADGE_TIERS.map((t) => ({ ...t, name: arabic ? t.ar : t.name }))
  const currentTier = getCurrentBadge(displayXp)
  const nextTier = getNextBadge(displayXp)

  const toggle = (key) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Header card */}
      <div className="animate-bubble-in mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg, var(--energy-blue), var(--energy-violet))' }}>
        <div className="flex items-center gap-4">
          <Mascot size={64} animate mood="proud" className="animate-bobble" />
          <div className="flex-1">
            <h1 className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>{user.name || (arabic ? 'طالب' : 'Student')}</h1>
            <p className="text-sm font-semibold text-white/80">{user.email || ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 p-1.5">
              <img src={currentTier.image} alt={currentTier.name} className="h-full w-full object-contain drop-shadow-md" />
            </div>
            <div className="text-end">
              <p className="text-2xl font-extrabold">Lv {profileLevel}</p>
              <p className="text-xs font-extrabold text-white/90">{currentTier.name}</p>
              <p className="text-[10px] font-semibold text-white/70">
                {nextTier ? `${nextTier.xp - displayXp} XP ${arabic ? 'لفتح' : 'to'} ${nextTier.name}` : (arabic ? 'أعلى رتبة!' : 'Max tier!')}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full animate-grow-bar rounded-full bg-white transition-all duration-700" style={{ width: `${(intoLevel / 500) * 100}%` }} />
        </div>
        <p className="mt-1 text-right text-xs font-bold text-white/80">{displayXp} XP {arabic ? 'إجمالي' : 'total'}</p>
      </div>

      {/* Badge collection — all 9 tiers in numerical order */}
      <section className="bubble-card mb-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🏅 {arabic ? 'مجموعة الشارات' : 'Badge collection'}</h2>
          <span className="rounded-full bg-[var(--brand-light)] px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--brand)]">
            {badgeTiers.filter((t) => displayXp >= t.xp).length} / {badgeTiers.length}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {badgeTiers.map((tier, i) => {
            const unlocked = displayXp >= tier.xp
            const isCurrent = tier === currentTier
            return (
              <div
                key={tier.xp}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-bouncy hover:-translate-y-0.5 ${
                  isCurrent
                    ? 'border-orange-400 bg-gradient-to-b from-orange-50 to-amber-100/60 shadow-md dark:from-orange-950/40 dark:to-amber-950/20'
                    : unlocked
                      ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'
                      : 'border-[var(--line)] bg-white/30 opacity-50 dark:bg-slate-900/20'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold ${
                  isCurrent ? 'text-white' : unlocked ? 'text-white' : 'bg-[var(--line)] text-[var(--muted)]'
                }`} style={isCurrent ? { background: 'var(--energy-orange)' } : unlocked ? { background: 'var(--energy-blue)' } : {}}>{i + 1}</span>
                <img src={tier.image} alt={tier.name} className={`h-11 w-11 object-contain ${!unlocked ? 'grayscale' : ''}`} />
                <p className={`text-[10px] font-extrabold leading-tight ${isCurrent ? 'dark:text-orange-300' : unlocked ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`} style={isCurrent ? { color: 'var(--energy-orange)' } : {}}>
                  {tier.name}
                </p>
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                  isCurrent ? 'dark:bg-orange-800 dark:text-orange-200' : unlocked ? 'dark:bg-slate-800 dark:text-slate-200' : 'bg-[var(--line)] text-[var(--muted)]'
                }`} style={isCurrent ? { background: 'color-mix(in srgb, var(--energy-orange) 20%, transparent)', color: 'var(--energy-orange)' } : unlocked ? { background: 'var(--brand-light)', color: 'var(--brand)' } : {}}>
                  {tier.xp === 0 ? '0 XP' : `${tier.xp}+ XP`}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Brain Wheel */}
      <section className="bubble-card mb-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🧠 {arabic ? 'عجلة الدماغ (VARK)' : 'Brain Wheel (VARK)'}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowReveal(true)} className="brand-btn-ghost py-1.5 text-xs">{arabic ? 'اسلوب تعلمي' : 'Learning style'}</button>
            <Link to="/vark-quiz" className="brand-btn-ghost py-1.5 text-xs">{arabic ? 'أعد الاختبار' : 'Retake quiz'}</Link>
          </div>
        </div>
        {brainwheel?.values?.length === 4 ? (
          <BrainWheel data={brainwheel} />
        ) : entries.length > 0 ? (
          <div className="mt-4 space-y-3">
            {entries.map(([key, value], i) => (
              <div key={key} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[var(--ink)]">{VARK_COPY[key].icon} {arabic ? VARK_COPY[key].ar : VARK_COPY[key].en}</span>
                  <span style={{ color: VARK_COPY[key].color }}>{Math.round(Number(value))}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
                  <div className="h-full animate-grow-bar rounded-full transition-all duration-700" style={{ width: `${Math.min(Number(value), 100)}%`, background: VARK_COPY[key].color }} />
                </div>
                <p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">{arabic ? VARK_COPY[key].desc.ar : VARK_COPY[key].desc.en}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--muted)]">{arabic ? 'أكمل اختبار VARK لبناء ملفك.' : 'Complete the VARK quiz to build your profile.'}</p>
        )}
      </section>

      {/* SEN profile */}
      <section className="bubble-card mb-6 p-5">
        <h2 className="text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🧩 {arabic ? 'ملف الدعم (SEN)' : 'Support profile (SEN)'}</h2>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{arabic ? 'الدعم المفعّل يظهر كشارات على كل مقرر.' : 'Active supports show as badges on every course.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.length === 0 && <p className="text-xs font-semibold text-[var(--muted)]">{arabic ? 'لا توجد احتياجات مسجلة — هذا لا يمنع تفعيل أدوات الدعم أدناه.' : 'No flagged needs — you can still enable any support tool below.'}</p>}
          {flags.map((f) => {
            const copy = SEN_COPY[String(f).toLowerCase()]
            return (
              <span key={f} className="rounded-full border border-[var(--line)] bg-[var(--brand-light)] px-3 py-1 text-xs font-extrabold text-[var(--brand)]">
                {copy ? `${copy.icon} ${arabic ? copy.ar : copy.label}` : `🧩 ${f}`}
              </span>
            )
          })}
        </div>
      </section>

      {/* Accessibility suite */}
      <section className="bubble-card mb-6 p-5">
        <h2 className="text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>♿ {arabic ? 'إعدادات الوصول' : 'Accessibility settings'}</h2>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{arabic ? 'تُحفظ تلقائياً على جهازك وتُطبق فوراً.' : 'Saved automatically on your device and applied instantly.'}</p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {SUITE_TOGGLES.map((item, i) => {
            const on = !!toggles[item.key]
            return (
              <button
                key={item.key}
                onClick={() => toggle(item.key)}
                className={`animate-bubble-in flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-bouncy ${on ? 'border-[var(--brand)] bg-[var(--brand-light)]' : 'border-[var(--line)] hover:border-[var(--brand)]'}`}
                style={{ animationDelay: `${i * 0.05}s` }}
                aria-pressed={on}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="flex-1">
                  <span className="block text-xs font-extrabold text-[var(--ink)]">{arabic ? item.ar : item.en}</span>
                  <span className="block text-[10px] font-semibold text-[var(--muted)]">{arabic ? item.desc.ar : item.desc.en}</span>
                </span>
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'start-[1.15rem]' : 'start-0.5'}`} />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Settings shortcut */}
      <div className="pb-8 text-center">
        <Link to="/settings" className="brand-btn-secondary">{arabic ? 'إدارة الموضوعات والمصادر' : 'Manage subjects & sources'}</Link>
      </div>

      {showReveal && <TemplateRevealPopup onClose={() => setShowReveal(false)} />}
    </div>
  )
}
