import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import LearnerQuestionnaire from '../components/LearnerQuestionnaire'
import api from '../services/api'
import { emptySenAnswers, scoreLearnerScreen, VARK_ITEMS } from '../utils/learnerScreening'

export default function VarkQuiz() {
  const { user, lang, updateUser } = useApp()
  const navigate = useNavigate()
  const arabic = lang === 'ar'
  const [phase, setPhase] = useState('sen')
  const [senAnswers, setSenAnswers] = useState(emptySenAnswers)
  const [varkChoices, setVarkChoices] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />
  if (user.onboarding_complete) return <Navigate to="/dashboard" replace />

  const submit = async (choices) => {
    setBusy(true)
    setError('')
    try {
      const screening = scoreLearnerScreen(senAnswers, choices)
      const result = await api.submitVarkQuiz({
        user_id: user.id,
        sen_flags: screening.flags,
        sen_scores: screening.scores,
        sen_profile: screening.profile,
        vark: screening.vark,
        vark_answers: choices,
        sen_answers: senAnswers,
      })
      const prof = result?.profile || {}
      updateUser({
        ...prof,
        id: prof.user_id || user.id,
        onboarding_complete: true,
        conditions: prof.sen_flags || screening.flags,
        sen_flags: prof.sen_flags || screening.flags,
        sen_scores: prof.sen_scores || screening.scores,
        sen_profile: prof.sen_profile || screening.profile,
        vark: prof.vark || screening.vark,
      })
      localStorage.setItem('shaghoof_show_reveal', '1')
      navigate('/dashboard', { replace: true })
    } catch {
      setError(arabic ? 'تعذر حفظ النتيجة. حاول مرة أخرى.' : 'We could not save your result. Please try again.')
      setBusy(false)
    }
  }

  const handleVarkChoice = (style) => {
    const next = [...varkChoices, style]
    if (next.length < VARK_ITEMS.length) {
      setVarkChoices(next)
      return
    }
    submit(next)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 style={{ fontFamily: 'var(--font-heading)' }} className="text-2xl font-bold text-[var(--ink)]">
            {phase === 'sen' ? 'Learning Support Screen' : 'VARK Learning Style'}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {phase === 'sen'
              ? 'The SEN overlay will apply on every tab, with higher priority.'
              : 'The VARK core layer will shape how content is presented.'}
          </p>
        </div>
        <section className="border border-[var(--line)] rounded-lg p-6 bg-[var(--surface)]">
          <LearnerQuestionnaire
            lang={lang}
            phase={phase}
            senAnswers={senAnswers}
            varkChoices={varkChoices}
            onSenChange={(id, value) => setSenAnswers((prev) => ({ ...prev, [id]: value }))}
            onVarkChoice={handleVarkChoice}
            onBack={() => {
              if (phase === 'vark') {
                setVarkChoices([])
                setPhase('sen')
              }
            }}
            onContinue={() => setPhase('vark')}
          />
          {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-center text-sm font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          {busy && <p className="mt-6 text-center text-sm font-semibold dark:text-violet-300" style={{ color: 'var(--energy-violet)' }}>{arabic ? 'نحلّل اختياراتك…' : 'Building your learning profile…'}</p>}
        </section>
      </div>
    </div>
  )
}
