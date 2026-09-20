import { useState, useEffect } from 'react'

const REACTIONS = {
  correct: { image: '/brand/mascot-excited.png', text: { en: 'Great job!', ar: '!أحسنت' }, emoji: '🎉' },
  lesson: { image: '/brand/mascot-happy.png', text: { en: 'Lesson complete!', ar: '!اكتمل الدرس' }, emoji: '📚' },
  quiz: { image: '/brand/mascot-excited.png', text: { en: 'Quiz passed!', ar: '!نجحت في الاختبار' }, emoji: '⭐' },
  streak: { image: '/brand/mascot-excited.png', text: { en: 'On fire!', ar: '!مشتعل' }, emoji: '🔥' },
  levelup: { image: '/brand/mascot-excited.png', text: { en: 'Level up!', ar: '!ارتقاء المستوى' }, emoji: '⬆️' },
  idle: { image: '/brand/mascot-idle.png', text: { en: 'Ready when you are!', ar: '!جاهز متى ما كنت' }, emoji: '🙂' },
}

export default function MascotReaction({ type = 'correct', text, duration = 3000, onDone }) {
  const [visible, setVisible] = useState(true)
  const reaction = REACTIONS[type] || REACTIONS.correct
  const displayText = text || reaction.text

  useEffect(() => {
    if (duration <= 0) return
    const t = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onDone])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center pointer-events-none">
      {/* Backdrop fade */}
      <div className="absolute inset-0 bg-black/10 animate-fade-in" />

      {/* Reaction card */}
      <div className="relative animate-pop-in flex flex-col items-center gap-3 px-8 py-6 rounded-3xl" style={{
        background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '2px solid color-mix(in srgb, var(--energy-sunshine) 30%, transparent)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 40px color-mix(in srgb, var(--energy-sunshine) 15%, transparent)',
      }}>
        {/* Sparkles */}
        <span className="absolute -top-4 -right-3 text-2xl animate-sparkle" style={{ animationDelay: '0.1s' }}>{reaction.emoji}</span>
        <span className="absolute -top-2 -left-4 text-xl animate-sparkle" style={{ animationDelay: '0.4s' }}>{'✨'}</span>
        <span className="absolute -bottom-2 -right-4 text-lg animate-sparkle" style={{ animationDelay: '0.7s' }}>{'⭐'}</span>

        {/* Mascot */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--energy-sunshine) 20%, transparent), transparent 70%)' }} />
          <img src={reaction.image} alt="Shaghoof" className="relative w-28 h-28 object-contain drop-shadow-lg animate-mascot-bounce" />
        </div>

        {/* Text */}
        <p className="text-lg font-extrabold text-[var(--ink)] text-center" style={{ fontFamily: 'var(--font-heading)' }}>
          {displayText.en || displayText}
        </p>
      </div>
    </div>
  )
}
