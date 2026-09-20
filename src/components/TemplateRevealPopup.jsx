import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { resolveLearningTemplate } from '../utils/learningTemplate'

const TEMPLATE_PHOTO = {
  T1: '/brand/template-T1.png',
  T2: '/brand/template-T2.png',
  T3: '/brand/mascot-main.png',
  T4: '/brand/template-T4.png',
  T5: '/brand/template-T5.png',
  T6: '/brand/template-T6.png',
}

const REASON = {
  T1: {
    en: 'Short hands-on quests match your focus style. One action at a time, then instant feedback.',
    ar: 'مهام قصيرة عملية تتناسب مع أسلوب تركيزك. خطوة واحدة في كل مرة، ثم ملاحظات فورية.',
  },
  T2: {
    en: 'You learn best by listening. The Podcast delivers lessons as audio-first with transcripts at your pace.',
    ar: 'تتعلم الأفضل بالاستماع. البودكاست يقدم الدروس كصوت أولاً مع النص بالسرعة التي تناسبك.',
  },
  T3: {
    en: 'Visual sequences help you build mental models. The Storyboard uses scenes, questions, and answers in a calm rhythm.',
    ar: 'التصاميم البصرية تساعدك على بناء نماذج ذهنية. اللوحة القصصية تستخدم مشاهد وأسئلة وإجابات بإيقاع هادئ.',
  },
  T4: {
    en: 'You thrive with structured reading. The Translator provides glossary, split reading supports, and simplified wording.',
    ar: 'تنجح مع القراءة المنظمة. المترجم يوفر مسرد ودعم قراءة مقسوم وصياغة مبسطة.',
  },
  T5: {
    en: 'Diagrams plus concise bullets with speech on every line. Visual exploration with audio backup.',
    ar: 'رسوم مع نقاط مختصرة والصوت على كل سطر. استكشاف بصري مع دعم صوتي.',
  },
  T6: {
    en: 'A calm timeline, concrete language, and limited sensory load. The same safe sequence every time.',
    ar: 'جدول زمني هادئ، لغة مباشرة، وحمل حسي محدود. التسلسل الآمن نفسه في كل مرة.',
  },
}

const COPY = {
  discover: { en: 'We discovered your learning style!', ar: '!اكتشفنا أسلوب تعلمك' },
  templateIs: { en: 'Your template is', ar: 'قالبك هو' },
  why: { en: 'Why this template?', ar: 'لماذا هذا القالب؟' },
  close: { en: 'Got it!', ar: '!فهمت' },
}

export default function TemplateRevealPopup({ onClose }) {
  const { user, lang } = useApp()
  const arabic = lang === 'ar'
  const template = resolveLearningTemplate(user)
  const reason = REASON[template.id] || REASON.T3
  const [flipped, setFlipped] = useState(false)

  // Auto-flip after 1.8s
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 1800)
    return () => clearTimeout(t)
  }, [])

  const mc = {
    visual:      { bg: 'var(--energy-cyan)',    border: 'var(--energy-cyan)' },
    auditory:    { bg: 'var(--energy-pink)',    border: 'var(--energy-pink)' },
    reading:     { bg: 'var(--energy-violet)',  border: 'var(--energy-violet)' },
    kinesthetic: { bg: 'var(--energy-orange)',  border: 'var(--energy-orange)' },
  }[template.mode] || { bg: 'var(--energy-blue)', border: 'var(--energy-blue)' }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto" style={{ background: `radial-gradient(ellipse at center, color-mix(in srgb, ${mc.bg} 12%, transparent), var(--page) 70%)` }}>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="absolute rounded-full opacity-0 animate-float-up" style={{
            left: `${6 + (i * 6) % 88}%`,
            bottom: '-8%',
            width: `${4 + (i % 4) * 3}px`,
            height: `${4 + (i % 4) * 3}px`,
            background: mc.bg,
            animationDelay: `${i * 0.35}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center px-4 sm:px-6 max-w-md w-full py-8">

        {/* ── Headline ── */}
        <div className="tr-phase tr-phase-1 mb-5">
          <p className="text-sm sm:text-base font-extrabold uppercase tracking-[.18em]" style={{ color: mc.bg }}>
            {arabic ? COPY.discover.ar : COPY.discover.en}
          </p>
        </div>

        {/* ── Flip Card — front = photo, back = icon + name ── */}
        <div className="tr-phase tr-phase-2">
          <div className={`tr-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f) }}>
            {/* FRONT — mascot photo only */}
            <div className="tr-face tr-front" style={{ borderColor: mc.border }}>
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(145deg, color-mix(in srgb, var(--surface) 90%, transparent), color-mix(in srgb, ${mc.bg} 8%, transparent))` }}>
                <img src={TEMPLATE_PHOTO[template.id] || '/brand/mascot-main.png'} alt={template.name} className="w-[85%] h-[85%] object-contain drop-shadow-lg" />
                <span className="absolute top-3 right-4 text-xl animate-sparkle" style={{ animationDelay: '0.2s' }}>{'✨'}</span>
                <span className="absolute bottom-4 left-3 text-lg animate-sparkle" style={{ animationDelay: '0.7s' }}>{'⭐'}</span>
                <span className="absolute top-1/3 -left-1 text-base animate-sparkle" style={{ animationDelay: '1.1s' }}>{'🌟'}</span>
              </div>
            </div>

            {/* BACK — template icon + name */}
            <div className="tr-face tr-back" style={{ borderColor: mc.border }}>
              <div className="relative w-full h-full flex flex-col items-center justify-center p-6 overflow-hidden" style={{ background: `linear-gradient(145deg, color-mix(in srgb, var(--surface) 92%, transparent), color-mix(in srgb, ${mc.bg} 10%, transparent))` }}>
                <span className="text-5xl mb-3">{template.icon}</span>
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] mb-1" style={{ color: mc.bg }}>
                  {arabic ? COPY.templateIs.ar : COPY.templateIs.en}
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                  {template.name}
                </h2>
                <span className="absolute top-3 left-4 text-base animate-sparkle" style={{ animationDelay: '0.3s' }}>{'✨'}</span>
                <span className="absolute bottom-3 right-4 text-sm animate-sparkle" style={{ animationDelay: '0.8s' }}>{'⭐'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Text under the card ── */}
        <div className={`tr-phase tr-phase-3 mt-5 w-full transition-all duration-700 ${flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Template name badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-5 py-2 border-2 mb-3" style={{ borderColor: mc.border, background: `color-mix(in srgb, ${mc.bg} 10%, transparent)` }}>
            <span className="text-xl">{template.icon}</span>
            <span className="text-base font-extrabold" style={{ color: mc.bg }}>{template.name}</span>
          </div>

          {/* Why section */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur p-4 text-left mb-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--muted)] mb-1.5">
              {arabic ? COPY.why.ar : COPY.why.en}
            </p>
            <p className="text-sm font-semibold leading-relaxed text-[var(--ink)]">
              {arabic ? reason.ar : reason.en}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `color-mix(in srgb, ${mc.bg} 18%, transparent)`, color: mc.bg }}>{template.mode}</span>
            <span className="rounded-full bg-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)]">{template.profile}</span>
            {template.structured && <span className="rounded-full bg-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)]">{arabic ? 'منظم' : 'Structured'}</span>}
            {template.visualAid && <span className="rounded-full bg-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)]">{arabic ? 'مساعد بصري' : 'Visual Aid'}</span>}
          </div>

          {/* CTA */}
          <button onClick={onClose} className="brand-btn-primary px-8 py-3 text-base font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-bouncy">
            {arabic ? COPY.close.ar : COPY.close.en}
          </button>
        </div>
      </div>
    </div>
  )
}
