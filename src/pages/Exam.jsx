import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Mascot from '../components/Mascot'
import api from '../services/api'
import { speak, stopSpeaking } from '../services/speech'
import { resolveLearningTemplate } from '../utils/learningTemplate'

const MOTIVATIONAL = [
  'You got this!',
  'Small steps, big dreams!',
  'Keep going!',
  'Almost there!',
  'Learning is an adventure!',
]

// Growth-mindset framing (master plan: SEMH suite — Safe Failure Framing)
const SAFE_FAILURE = [
  'Great try! Every mistake helps your brain grow. 🌱',
  "Not yet — but 'yet' is the magic word! ✨",
  'Your brain just got a little stronger. 💪',
]

function QuizSetup({ onStart }) {
  const { user } = useApp()
  const [searchParams] = useSearchParams()
  const subjects = user?.subjects || []
  const template = user ? resolveLearningTemplate(user) : null
  const [subject, setSubject] = useState(() => searchParams.get('subject') || '')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState('Medium')
  const [loading, setLoading] = useState(false)

  // Map learning-template quizFormat → backend question_types mix.
  const FORMAT_TO_TYPES = {
    sandbox: ['mcq', 'true_false'],
    podcast: ['mcq', 'fill_blank'],
    storyboard: ['mcq', 'true_false'],
    translator: ['fill_blank', 'short_answer', 'mcq'],
    explorer: ['mcq', 'true_false', 'fill_blank'],
    routine: ['mcq', 'true_false', 'fill_blank'],
  }

  const handleStart = async () => {
    const quizTopic = topic.trim() || subject
    if (!quizTopic) return
    setLoading(true)
    try {
      const questionTypes = template?.quizFormat ? FORMAT_TO_TYPES[template.quizFormat] : undefined
      const res = await api.generateQuiz({
        topic: quizTopic, subject: subject || undefined, n: count, difficulty,
        user_id: user.id, ground_in_lessons: true,
        question_types: questionTypes,
      })
      onStart(res)
    } catch { alert('Failed to generate quiz.') } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="border border-[var(--line)] rounded-lg p-6 bg-[var(--surface)]">
        <div className="text-center mb-6">
          <Mascot size={56} animate mood="excited" />
          <h1 className="text-xl font-bold text-[var(--ink)] mt-3" style={{ fontFamily: 'var(--font-heading)' }}>Quiz</h1>
          <p className="text-sm text-[var(--muted)]">Test your knowledge</p>
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-[var(--muted)] mb-3">No subjects yet. Add them in Settings.</p>
            <Link to="/settings" className="brand-btn-primary text-sm">Go to Settings</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="brand-input">
                <option value="">Select a subject...</option>
                {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Topic</label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={subject ? `Topics in ${subject}...` : 'e.g. Photosynthesis, Algebra...'} className="brand-input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Difficulty</label>
              <div className="flex gap-2">
                {['Easy', 'Medium', 'Hard'].map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${difficulty === d ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Questions</label>
              <div className="flex gap-2">
                {[3, 5, 8, 10].map((n) => (
                  <button key={n} onClick={() => setCount(n)} className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${count === n ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{n}</button>
                ))}
              </div>
            </div>
            <button onClick={handleStart} disabled={(!topic.trim() && !subject) || loading} className="w-full brand-btn-primary py-2.5">
              {loading ? 'Generating...' : 'Start Quiz'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// VARK + SEN presentation of quiz questions (mirrors the lesson template):
//  - auditory learners / audioQuiz toggle: auto + on-tap read-aloud of stems and options
//  - visual learners / visualQuiz toggle: picturable option icons
//  - focus overlay: calmer spacing, no countdown color alarm
const OPTION_ICONS = ['🅰️', '🆎', '🅾️', '🆑']

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/[.!?،,]/g, '').replace(/\s+/g, ' ')

function isCorrectAnswer(question, given) {
  if (!question) return false
  const type = question.type || 'mcq'
  if (type === 'mcq' || type === 'true_false') {
    return given === question.correct
  }
  // fill_blank / short_answer — string match against accepted answers
  const accepted = (question.accepted_answers || []).map(normalize)
  const canon = normalize(question.correct_answer)
  if (canon) accepted.push(canon)
  const g = normalize(given)
  if (!g) return false
  if (accepted.includes(g)) return true
  // keyword containment for short answers
  return accepted.some((a) => a.length > 3 && (a.includes(g) || g.includes(a)))
}

function QuizQuestion({ question, index, total, onAnswer, selected, showResult, speakIt, visualIcons, calm }) {
  const { lang } = useApp()
  const optText = (opt) => (typeof opt === 'string' ? opt : opt?.text || '')
  const type = question?.type || 'mcq'
  const [textValue, setTextValue] = useState('')

  useEffect(() => {
    if (speakIt && !showResult && question?.question) {
      speak(question.question, { lang, rate: 0.92 })
    }
    setTextValue(typeof selected === 'string' ? selected : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.question, speakIt])

  const correct = isCorrectAnswer(question, selected)

  const submitText = () => {
    if (!textValue.trim() || showResult) return
    onAnswer(textValue.trim())
    if (speakIt) stopSpeaking()
  }

  const typeBadge = type !== 'mcq' && (
    <span className="ms-2 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand)] uppercase">
      {type.replace('_', ' ')}
    </span>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-[var(--muted)]">Question {index + 1} of {total}</span>
        <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${calm ? 'border-[var(--muted)] text-[var(--muted)]' : 'border-[var(--brand)] text-[var(--brand)]'}`}>{Math.round(((index + 1) / total) * 100)}%</div>
      </div>
      <div className="brand-progress mb-6"><div className="brand-progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>

      <div className={`border border-[var(--line)] rounded-lg bg-[var(--surface)] ${calm ? 'p-6' : 'p-5'}`}>
        <div className="flex items-start gap-2 mb-4">
          <h2 className="text-base font-medium text-[var(--ink)] flex-1">
            {question.question}
            {typeBadge}
          </h2>
          {speakIt && (
            <button
              type="button"
              onClick={() => speak(question.question, { lang, rate: 0.92 })}
              className="shrink-0 rounded-full border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)] hover:border-[var(--brand)]"
              title="Listen"
              aria-label="Listen to question"
            >
              🔊
            </button>
          )}
        </div>

        {/* ── MCQ / True-False choice buttons ── */}
        {(type === 'mcq' || type === 'true_false') && (
          <div className={calm ? 'space-y-3' : 'space-y-2'}>
            {question.options?.map((opt, i) => {
              const letter = type === 'true_false' ? (i === 0 ? 'T' : 'F') : String.fromCharCode(65 + i)
              const isSelected = selected === i
              const isRight = i === question.correct
              const showCorrect = showResult && isRight
              const showWrong = showResult && isSelected && !isRight

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!showResult) {
                      onAnswer(i)
                      if (speakIt) stopSpeaking()
                    }
                  }}
                  disabled={showResult}
                  className={`w-full flex items-center gap-3 rounded-md p-3 text-left text-sm border transition-colors ${
                    showCorrect ? 'border-green-400 bg-green-50' :
                    showWrong ? 'border-red-400 bg-red-50' :
                    isSelected ? 'border-[var(--brand)] bg-[var(--brand-light)]' :
                    'border-[var(--line)] hover:border-[var(--brand)]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    showCorrect ? 'bg-green-500 text-white' :
                    showWrong ? 'bg-red-500 text-white' :
                    isSelected ? 'bg-[var(--brand)] text-white' :
                    'bg-gray-100 text-[var(--muted)]'
                  }`}>
                    {showCorrect ? '✓' : showWrong ? '✕' : letter}
                  </div>
                  {visualIcons && !showResult && type === 'mcq' && <span className="shrink-0 text-base" aria-hidden="true">{OPTION_ICONS[i % OPTION_ICONS.length]}</span>}
                  <span className={`${showCorrect ? 'text-green-700 font-medium' : showWrong ? 'text-red-700' : 'text-[var(--ink)]'} flex-1`}>
                    {optText(opt)}
                    {speakIt && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); speak(optText(opt), { lang, rate: 0.92 }) }}
                        className="ms-2 rounded px-1 text-[10px] text-[var(--muted)] hover:text-[var(--brand)]"
                        title="Listen"
                        aria-label={`Listen to option ${letter}`}
                      >🔊</button>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── fill_blank / short_answer text entry ── */}
        {(type === 'fill_blank' || type === 'short_answer') && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
              {type === 'fill_blank' ? 'Fill in the blank' : 'Short answer'}
            </label>
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitText()}
              disabled={showResult}
              placeholder={type === 'fill_blank' ? 'Type the missing word(s)…' : 'Type a short answer…'}
              className="w-full brand-input"
              autoFocus={!showResult}
            />
            <button
              type="button"
              onClick={submitText}
              disabled={showResult || !textValue.trim()}
              className="w-full brand-btn-primary py-2"
            >
              Check answer
            </button>
            {showResult && question.correct_answer && (
              <p className="text-xs text-[var(--muted)]">
                Correct answer: <strong className="text-green-600">{question.correct_answer}</strong>
              </p>
            )}
          </div>
        )}

        {showResult && (type === 'mcq' || type === 'true_false') && (
          <div className={`animate-bubble-in mt-4 rounded-2xl p-3 text-center text-sm font-bold ${selected === question.correct ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
            {selected === question.correct ? '🎉 Correct! +5 XP' : SAFE_FAILURE[Math.floor(Math.random() * SAFE_FAILURE.length)]}
          </div>
        )}
        {showResult && (type === 'fill_blank' || type === 'short_answer') && (
          <div className={`animate-bubble-in mt-4 rounded-2xl p-3 text-center text-sm font-bold ${correct ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
            {correct ? '🎉 Correct! +5 XP' : SAFE_FAILURE[Math.floor(Math.random() * SAFE_FAILURE.length)]}
          </div>
        )}
      </div>
    </div>
  )
}

function QuizResults({ questions, answers, onRetry }) {
  const { awardXp, user } = useApp()
  const correct = questions.filter((q, i) => isCorrectAnswer(q, answers[i])).length
  const total = questions.length
  const pct = Math.round((correct / total) * 100)
  const xp = correct * 5

  useEffect(() => {
    awardXp(xp, 'Quiz')
    // Persist session so the teacher roster / dashboard can see exam history.
    const payload = {
      user_id: user?.id,
      topic: 'Quiz',
      total_questions: total,
      correct_count: correct,
      score: pct,
      growth_score: 0,
      xp_earned: xp,
      mode: 'quiz',
    }
    if (user?.id) {
      api.saveAssessmentSession(payload).catch(() => {})
      api.trackEvent({ user_id: user.id, event_type: 'quiz_submitted', meta: { score: pct, correct, total } }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="animate-pop-in rounded-3xl border border-[var(--line)] p-6 bg-[var(--surface)] text-center shadow-lg">
        <Mascot size={64} animate mood={pct >= 80 ? 'celebrating' : pct >= 50 ? 'happy' : 'thinking'} />
        <h1 className="text-xl font-bold text-[var(--ink)] mt-3" style={{ fontFamily: 'var(--font-heading)' }}>Quiz Complete!</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]}</p>
        <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">⭐ +{xp} XP earned</p>

        <div className="flex justify-center my-6">
          <div className="h-24 w-24 rounded-full border-4 border-[var(--brand)] flex items-center justify-center">
            <div>
              <p className="text-2xl font-bold text-[var(--brand)]">{pct}%</p>
              <p className="text-[10px] text-[var(--muted)]">{correct}/{total}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg bg-green-50 p-3 border border-green-200">
            <p className="text-lg font-bold text-green-600">{correct}</p>
            <p className="text-xs text-green-600">Correct</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 border border-red-200">
            <p className="text-lg font-bold text-red-600">{total - correct}</p>
            <p className="text-xs text-red-600">Wrong</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
            <p className="text-lg font-bold text-blue-600">{pct}%</p>
            <p className="text-xs text-blue-600">Score</p>
          </div>
        </div>

        <div className="space-y-2 mb-6 text-left">
          {questions.map((q, i) => {
            const ok = isCorrectAnswer(q, answers[i])
            const given = typeof answers[i] === 'string'
              ? answers[i]
              : (typeof q.options?.[answers[i]] === 'string' ? q.options[answers[i]] : 'N/A')
            const right = q.correct_answer
              || (typeof q.options?.[q.correct] === 'string' ? q.options[q.correct] : 'N/A')
            return (
              <div key={i} className={`rounded-lg p-3 border ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <p className="text-xs font-medium text-[var(--ink)] line-clamp-1">
                  {i + 1}. {q.question}
                  {q.type && q.type !== 'mcq' && (
                    <span className="ms-1 text-[9px] uppercase opacity-60">{q.type}</span>
                  )}
                </p>
                <p className={`text-[11px] mt-0.5 ${ok ? 'text-green-600' : 'text-red-600'}`}>
                  Your answer: {given}
                  {!ok && <span className="ml-2 text-green-600">Correct: {right}</span>}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry} className="brand-btn-primary flex-1 py-2.5">Try Again</button>
          <Link to="/dashboard" className="brand-btn-ghost flex-1 py-2.5 text-center">Dashboard</Link>
        </div>
      </div>
    </div>
  )
}

export default function Exam() {
  const { toggles } = useApp()
  const [quiz, setQuiz] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResult, setShowResult] = useState(false)
  const [finished, setFinished] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)

  // Quiz presentation follows the SAME template as lessons (VARK + SEN):
  const adaptation = quiz?.adaptation || {}
  const speakIt = !!toggles?.audioQuiz || adaptation.vark_mode === 'auditory' || adaptation.template_id === 'T2'
  const visualIcons = !!toggles?.visualQuiz || adaptation.vark_mode === 'visual'
  const calm = adaptation.sen_profile === 'focus' || adaptation.sen_profile === 'structure'

  useEffect(() => {
    if (!quiz || finished || timeLeft === null) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); setFinished(true); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [quiz, finished, timeLeft])

  const startQuiz = (data) => {
    setQuiz(data)
    setCurrentQ(0)
    setAnswers({})
    setShowResult(false)
    setFinished(false)
    setTimeLeft(data.questions?.length * 45 || 300)
  }

  const handleAnswer = (value) => {
    setAnswers((prev) => ({ ...prev, [currentQ]: value }))
    setShowResult(true)
    setTimeout(() => {
      setShowResult(false)
      if (currentQ < quiz.questions.length - 1) {
        setCurrentQ((prev) => prev + 1)
      } else {
        setFinished(true)
      }
    }, 1600)
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (finished && quiz) {
    return <QuizResults questions={quiz.questions} answers={answers} onRetry={() => { setQuiz(null); setFinished(false) }} />
  }

  if (!quiz) return <QuizSetup onStart={startQuiz} />

  const focusOverlay = calm
  return (
    <div className="lessons-bg px-4 py-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-[var(--ink)]">
            {quiz.topic}
            {(speakIt || visualIcons) && (
              <span className="ms-2 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand)]">
                {adaptation.template_id ? `${adaptation.template_id} adapted` : 'adapted'}
              </span>
            )}
          </span>
          {!focusOverlay && (
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${timeLeft < 60 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
              {formatTime(timeLeft)}
            </span>
          )}
        </div>
        <QuizQuestion
          question={quiz.questions[currentQ]}
          index={currentQ}
          total={quiz.questions.length}
          onAnswer={handleAnswer}
          selected={answers[currentQ]}
          showResult={showResult}
          speakIt={speakIt}
          visualIcons={visualIcons}
          calm={calm}
        />
      </div>
    </div>
  )
}
