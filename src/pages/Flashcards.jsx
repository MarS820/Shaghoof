import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'

const RECALL_LABELS = {
  correct: { en: 'Got it', ar: 'عرفتها', emoji: '\u2705', color: 'var(--energy-mint)' },
  hard: { en: 'Hard', ar: 'صعبة', emoji: '\ud83e\udd14', color: 'var(--energy-orange)' },
  unknown: { en: "Don't know", ar: '\u0644\u0627 \u0623\u0639\u0631\u0641', emoji: '\u274c', color: 'var(--energy-pink)' },
}

export default function Flashcards() {
  const { user, lang } = useApp()
  const [searchParams] = useSearchParams()
  const arabic = lang === 'ar'
  const [subjects, setSubjects] = useState([])
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState(() => searchParams.get('subject') || '')
  const [count, setCount] = useState(6)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cards, setCards] = useState([])
  const [flipped, setFlipped] = useState({})
  const [studyIndex, setStudyIndex] = useState(0)
  const [mode, setMode] = useState('browse')
  const [recall, setRecall] = useState({})
  const [sessionStats, setSessionStats] = useState(null)

  useEffect(() => {
    setSubjects(user?.subjects || JSON.parse(localStorage.getItem('shaghoof_user') || '{}').subjects || [])
  }, [user?.subjects])

  const generate = async () => {
    const quizTopic = topic.trim() || subject
    if (!quizTopic) return
    setLoading(true)
    setError('')
    try {
      const res = await api.generateFlashcards({ topic: quizTopic, n: count, user_id: user?.id || undefined })
      setCards(res.cards || res.flashcards || [])
      setFlipped({})
      setStudyIndex(0)
      setRecall({})
      setSessionStats(null)
    } catch {
      setCards([])
      setError(arabic ? '\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a. \u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b.' : 'Could not generate flashcards. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleFlip = (idx) => setFlipped((prev) => ({ ...prev, [idx]: !prev[idx] }))

  const markRecall = (idx, level) => {
    const next = { ...recall, [idx]: level }
    setRecall(next)
    if (studyIndex < cards.length - 1) {
      setStudyIndex(studyIndex + 1)
    } else {
      const stats = { correct: 0, hard: 0, unknown: 0, total: cards.length }
      Object.values(next).forEach((v) => { stats[v]++ })
      setSessionStats(stats)
    }
  }

  const card = cards[studyIndex]
  const cardRecall = recall[studyIndex]

  return (
    <div className="lessons-bg mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={48} animate mood="happy" className="mascot-float" />
        <div>
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--energy-blue)' }}>{'\ud83c\udccf'} {arabic ? '\u0628\u0637\u0627\u0642\u0627\u062a \u062a\u0639\u0644\u064a\u0645\u064a\u0629' : 'Flashcards'}</h1>
          <p className="text-sm text-[var(--muted)]">{arabic ? '\u0627\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u062a\u0630\u0643\u064a\u0631 \u0627\u0644\u0646\u0634\u0637 \u0644\u062a\u0639\u0632\u064a\u0632 \u0627\u0644\u062a\u0639\u0644\u064a\u0645' : 'Use active recall to reinforce learning'}</p>
        </div>
      </div>

      {cards.length === 0 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[var(--ink)]">{arabic ? '\u0627\u0644\u0645\u0627\u062f\u0629' : 'Subject'}</label>
            {subjects.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{arabic ? '\u0644\u0645 \u062a\u0636\u0641 \u0645\u0648\u0627\u062f \u0628\u0639\u062f. \u0623\u0636\u0641\u0647\u0627 \u0645\u0646 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a.' : 'No subjects found. Add subjects in Settings.'}</p>
            ) : (
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full brand-input">
                <option value="">{arabic ? '\u0627\u062e\u062a\u0631 \u0645\u0627\u062f\u0629...' : 'Select a subject...'}</option>
                {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[var(--ink)]">{arabic ? '\u0627\u0644\u0645\u0648\u0636\u0648\u0639' : 'Topic'}</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={arabic ? '\u0645\u062b\u0627\u0644: \u0627\u0644\u0643\u0633\u0648\u0631...' : 'e.g. Fractions, Chemical Reactions...'} className="w-full brand-input" />
          </div>
          <div className="flex gap-2">
            {[4, 6, 8, 10].map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`flex-1 brand-tag transition-standard ${count === n ? 'brand-btn-primary' : 'brand-btn-secondary'}`}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={(!topic.trim() && !subject) || loading} className="w-full brand-btn-primary py-3 disabled:opacity-40">
            {loading ? (arabic ? '\u062c\u0627\u0631\u064b \u0627\u0644\u0625\u0646\u0634\u0627\u0621...' : 'Generating...') : (arabic ? '\u0623\u0646\u0634\u0626 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a' : 'Create Flashcards')}
          </button>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        </div>
      )}

      {cards.length > 0 && !sessionStats && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setMode('browse')} className={`flex-1 brand-tag py-2 transition-standard ${mode === 'browse' ? 'brand-btn-primary' : 'brand-btn-secondary'}`}>
              {arabic ? '\u062a\u0635\u0641\u062d' : 'Browse All'}
            </button>
            <button onClick={() => setMode('study')} className={`flex-1 brand-tag py-2 transition-standard ${mode === 'study' ? 'brand-btn-primary' : 'brand-btn-secondary'}`}>
              {arabic ? '\u0648\u0636\u0639 \u0627\u0644\u0645\u0630\u0627\u0643\u0631\u0629' : 'Study Mode'}
            </button>
          </div>

          {mode === 'study' && card && (
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-2">
                <p className="text-xs font-bold text-[var(--muted)]">{studyIndex + 1} / {cards.length}</p>
                <div className="flex gap-1">
                  {Object.entries(RECALL_LABELS).map(([key, val]) => {
                    const cnt = Object.values(recall).filter((v) => v === key).length
                    return cnt > 0 ? <span key={key} className="text-[10px] font-bold" style={{ color: val.color }}>{val.emoji} {cnt}</span> : null
                  })}
                </div>
              </div>
              <div onClick={() => toggleFlip(studyIndex)} className="w-full cursor-pointer border border-[var(--line)] rounded-lg p-8 text-center transition-bouncy hover:shadow-lg" style={{ minHeight: 180 }}>
                {!flipped[studyIndex] ? (
                  <div>
                    <p className="text-xs font-bold text-blue-400 mb-2">{arabic ? '\u0627\u0644\u0648\u062c\u0647 \u0627\u0644\u0623\u0645\u0627\u0645\u064a' : 'FRONT'}</p>
                    <p className="text-lg font-bold text-[var(--ink)]">{card.front}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-green-400 mb-2">{arabic ? '\u0627\u0644\u0648\u062c\u0647 \u0627\u0644\u062e\u0644\u0641\u064a' : 'BACK'}</p>
                    <p className="text-lg text-[var(--ink)]">{card.back}</p>
                  </div>
                )}
              </div>
              {!flipped[studyIndex] ? (
                <button onClick={() => toggleFlip(studyIndex)} className="brand-btn-secondary mt-4 px-8">{arabic ? '\u0627\u0642\u0644\u0628' : 'Flip'}</button>
              ) : (
                <div className="flex gap-2 mt-4">
                  {Object.entries(RECALL_LABELS).map(([key, val]) => (
                    <button key={key} onClick={() => markRecall(studyIndex, key)} className="flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-extrabold transition-bouncy hover:scale-105 press-bubble" style={{ borderColor: cardRecall === key ? val.color : 'var(--line)', background: cardRecall === key ? `color-mix(in srgb, ${val.color} 15%, transparent)` : 'transparent', color: cardRecall === key ? val.color : 'var(--ink)' }}>
                      {val.emoji} {arabic ? val.ar : val.en}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'browse' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((c, i) => (
                <div key={i} onClick={() => toggleFlip(i)} className="cursor-pointer border border-[var(--line)] rounded-lg p-4 transition-bouncy hover:shadow-md" style={recall[i] ? { borderColor: RECALL_LABELS[recall[i]]?.color, background: `color-mix(in srgb, ${RECALL_LABELS[recall[i]]?.color} 5%, transparent)` } : {}}>
                  {!flipped[i] ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-blue-400">{arabic ? '\u0627\u0644\u0623\u0645\u0627\u0645\u064a' : 'Front'}</p>
                        {recall[i] && <span className="text-sm">{RECALL_LABELS[recall[i]]?.emoji}</span>}
                      </div>
                      <p className="text-sm font-bold text-[var(--ink)]">{c.front}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-green-400">{arabic ? '\u0627\u0644\u062e\u0644\u0641\u064a' : 'Back'}</p>
                        {recall[i] && <span className="text-sm">{RECALL_LABELS[recall[i]]?.emoji}</span>}
                      </div>
                      <p className="text-sm text-[var(--muted)]">{c.back}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { setCards([]); setFlipped({}); setRecall({}); setSessionStats(null) }} className="w-full brand-btn-ghost py-3">
            {arabic ? '\u0628\u0637\u0627\u0642\u0627\u062a \u062c\u062f\u064a\u062f\u0629' : 'New Flashcards'}
          </button>
        </div>
      )}

      {sessionStats && (
        <div className="animate-bubble-in rounded-3xl border-2 border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30 p-6 text-center">
          <p className="text-3xl">{'\ud83c\udf89'}</p>
          <p className="mt-2 text-lg font-extrabold text-[var(--ink)]">{arabic ? '\u0627\u0646\u062a\u0647\u064a\u062a!' : 'Session Complete!'}</p>
          <div className="mt-4 flex justify-center gap-4">
            {Object.entries(RECALL_LABELS).map(([key, val]) => (
              <div key={key} className="text-center">
                <p className="text-2xl">{val.emoji}</p>
                <p className="text-lg font-extrabold" style={{ color: val.color }}>{sessionStats[key]}</p>
                <p className="text-[10px] font-bold text-[var(--muted)]">{arabic ? val.ar : val.en}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
            {sessionStats.unknown === 0
              ? (arabic ? '\u0623\u062f\u0627\u0621 \u0631\u0627\u0626\u0639! \u0643\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0639\u0631\u0641\u062a\u0647\u0627' : 'Perfect recall! You knew every card')
              : sessionStats.unknown <= 2
                ? (arabic ? '\u062c\u064a\u062f \u062c\u062f\u0627\u064b! \u0631\u0627\u062c\u0639 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0635\u0639\u0628\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649' : 'Great job! Review the hard cards again')
                : (arabic ? '\u0627\u0633\u062a\u0645\u0631 \u0641\u064a \u0627\u0644\u0645\u0630\u0627\u0643\u0631\u0629 \u2014 \u0643\u0644 \u0645\u062d\u0627\u0648\u0644\u0629 \u062a\u0642\u0648\u064a \u0627\u0644\u0630\u0627\u0643\u0631\u0629' : 'Keep studying - each attempt strengthens memory')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => { const hard = {}; cards.forEach((_, i) => { if (recall[i] === 'hard' || recall[i] === 'unknown') hard[i] = recall[i] }); setRecall(hard); setStudyIndex(0); setSessionStats(null) }} className="brand-btn-secondary text-xs">{arabic ? '\u0631\u0627\u062c\u0639 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0635\u0639\u0628\u0629' : 'Review hard cards'}</button>
            <button onClick={() => { setCards([]); setFlipped({}); setRecall({}); setSessionStats(null) }} className="brand-btn-ghost text-xs">{arabic ? '\u0628\u0637\u0627\u0642\u0627\u062a \u062c\u062f\u064a\u062f\u0629' : 'New Flashcards'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
