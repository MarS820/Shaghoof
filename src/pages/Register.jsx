import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Mascot from '../components/Mascot'

import LearnerQuestionnaire from '../components/LearnerQuestionnaire'
import api, { apiTeacher } from '../services/api'
import { emptySenAnswers, scoreLearnerScreen, VARK_ITEMS } from '../utils/learnerScreening'

const SUBJECT_SUGGESTIONS = [
  'Math', 'Science', 'Physics', 'Chemistry', 'Biology', 'English',
  'Arabic', 'History', 'Geography', 'Computer Science', 'Art', 'Music',
]

const GRADES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
const gradeLabel = (g, arabic) => (arabic ? `الصف ${({ '1st': 'الأول', '2nd': 'الثاني', '3rd': 'الثالث', '4th': 'الرابع', '5th': 'الخامس', '6th': 'السادس', '7th': 'السابع', '8th': 'الثامن', '9th': 'التاسع', '10th': 'العاشر', '11th': 'الحادي عشر', '12th': 'الثاني عشر' })[g] || g}` : `${g} Grade`)

export default function Register() {
  const { t, lang, login } = useApp()
  const navigate = useNavigate()
  const arabic = lang === 'ar'
  const [step, setStep] = useState('account')
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', age: '', grade: '5th', schoolMode: false, subject: '', role: 'student' })
  const [senAnswers, setSenAnswers] = useState(emptySenAnswers)
  const [varkChoices, setVarkChoices] = useState([])
  // Latest SEN answers for the async submit (avoids stale closure).
  const senAnswersRef = useRef(emptySenAnswers)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ref sync, not state
    senAnswersRef.current = senAnswers
  }, [senAnswers])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }))

  const validateAccount = () => {
    const errs = {}
    if (!formData.name.trim()) errs.name = t.nameRequired
    if (!formData.email.trim()) errs.email = t.emailRequired
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = t.emailInvalid
    if (!formData.password) errs.password = t.passwordRequired
    else if (formData.password.length < 6) errs.password = arabic ? 'يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل' : 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = t.passwordsMismatch
    // Age is only required for home (non-school) students — school students
    // pick a grade instead, which auto-links them to their teacher's class.
    if (formData.role === 'student' && !formData.schoolMode && (!formData.age || formData.age < 6 || formData.age > 16)) errs.age = t.ageInvalid
    if (formData.role === 'student' && formData.schoolMode && !formData.grade) errs.grade = arabic ? 'اختر صفك' : 'Pick your grade'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    if (!validateAccount()) return
    // Pre-flight (students): fail fast on a taken email instead of after all 26 questions.
    if (formData.role === 'student') {
      try {
        const { available } = await api.emailAvailable(formData.email.trim())
        if (!available) {
          setErrors({ email: arabic ? 'هذا البريد مستخدم بالفعل. سجّل الدخول بدلاً من ذلك.' : 'An account with this email already exists. Try logging in instead.' })
          return
        }
      } catch {
        // Backend offline — let the real submit surface any duplicate later.
      }
    }
    // Teachers sign up straight to their dashboard; students continue to the
    // SEN questionnaire → VARK quiz.
    if (formData.role === 'teacher') {
      submitTeacherRegistration()
      return
    }
    setStep('sen')
  }

  const authErrorText = (err) => {
    // Error text may be `API error 409: {"detail":"..."}` — pull out the human part.
    const raw = err?.message?.match(/\d+: (.*)$/)?.[1] || err?.message || ''
    let detail = raw
    try { detail = JSON.parse(raw)?.detail || raw } catch { /* not JSON */ }
    if (Array.isArray(detail)) detail = detail[0]?.msg || 'Invalid registration data'
    return String(detail || '')
  }

  const submitTeacherRegistration = async () => {
    setLoading(true)
    setErrors({})
    try {
      const res = await apiTeacher.register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })
      const prof = res?.profile || res?.teacher || res
      login({ ...prof, id: prof.id || prof.user_id || formData.email.trim().toLowerCase(), role: 'teacher' })
      navigate('/teacher')
    } catch (err) {
      const detail = authErrorText(err)
      if (/already exists/i.test(detail)) {
        setErrors({ email: arabic ? 'هذا البريد مستخدم بالفعل. سجّل الدخول بدلاً من ذلك.' : 'An account with this email already exists. Try logging in instead.' })
      } else {
        setErrors({ submit: detail || (arabic ? 'تعذر إنشاء الحساب. حاول مجدداً.' : 'Registration failed. Please try again.') })
      }
    } finally { setLoading(false) }
  }

  const handleVarkChoice = (style) => {
    const next = [...varkChoices, style]
    setVarkChoices(next)
    if (next.length >= VARK_ITEMS.length) submitRegistration(next)
  }

  const submitRegistration = async (choices) => {
    const screen = scoreLearnerScreen(senAnswersRef.current, choices)
    setLoading(true)
    setErrors({})
    // user_id is REQUIRED by the backend RegisterIn model — derive it from the
    // email (or name) so registration works for any new account.
    const userId = formData.email.trim().toLowerCase().replace(/[^a-z0-9@.]/g, '_')
      || (formData.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36))
    const isSchool = formData.role === 'student' && formData.schoolMode
    try {
      const res = await api.register({
        user_id: userId,
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        // School students enroll by GRADE — the backend auto-links them to every
        // classroom a teacher created for that grade. Home students keep age.
        ...(isSchool
          ? { grade: formData.grade, school_user: true }
          : { age: Number(formData.age) || 10 }),
        // The subject the student cares about feeds lesson/quiz generation
        // (custom_topics + interests on the digital twin).
        custom_topic: formData.subject.trim() || undefined,
        sen_flags: screen.flags,
        sen_scores: screen.scores,
        sen_profile: screen.profile,
        vark: screen.vark,
      })
      // Backend returns { ok, profile } — profile already carries the id.
      const prof = res?.profile || res?.user || res
      login({ ...prof, id: prof.user_id || prof.id || userId, role: prof.role || formData.role })
      navigate(formData.role === 'teacher' ? '/teacher' : '/vark-quiz')
    } catch (err) {
      const detail = authErrorText(err)
      // A duplicate email found late must send the user back to fix it,
      // not strand them at the end of the questionnaire.
      if (/already exists/i.test(detail)) {
        setStep('account')
        setErrors({ email: arabic ? 'هذا البريد مستخدم بالفعل. سجّل الدخول بدلاً من ذلك.' : 'An account with this email already exists. Try logging in instead.' })
      } else {
        setErrors({ submit: detail || (arabic ? 'تعذر إنشاء الحساب. حاول مجدداً.' : 'Registration failed. Please try again.') })
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
      <div className="relative z-10 w-full max-w-lg">
        {step === 'account' && (
          <div className="animate-pop-in rounded-lg border border-[var(--line)] p-6 sm:p-8 md:p-10">
            <div className="mb-6 text-center sm:mb-8">
              <div className="mascot-float mb-4"><Mascot size={64} animate mood="happy" /></div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>{t.registerTitle}</h1>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 sm:text-base">{t.registerSubtitle}</p>
            </div>

            {errors.submit && <div className="animate-pop-in mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-500 dark:bg-red-900/20">{errors.submit}</div>}

            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <button type="button" onClick={() => update('role', 'student')} className={`rounded-2xl border-2 p-4 text-center transition-standard ${formData.role === 'student' ? 'shadow-md dark:text-blue-300' : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}`} style={formData.role === 'student' ? { borderColor: 'var(--energy-blue)', background: 'color-mix(in srgb, var(--energy-blue) 10%, transparent)', color: 'var(--energy-blue)' } : {}}>
                  <div className="mb-1 text-2xl">🎓</div>
                  <div className="text-sm font-bold">{t.roleStudent}</div>
                </button>
                <button type="button" onClick={() => update('role', 'teacher')} className={`rounded-2xl border-2 p-4 text-center transition-standard ${formData.role === 'teacher' ? 'shadow-md dark:text-purple-300' : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}`} style={formData.role === 'teacher' ? { borderColor: 'var(--energy-violet)', background: 'color-mix(in srgb, var(--energy-violet) 10%, transparent)', color: 'var(--energy-violet)' } : {}}>
                  <div className="mb-1 text-2xl">👩‍🏫</div>
                  <div className="text-sm font-bold">{t.roleTeacher}</div>
                </button>
              </div>

              {formData.role === 'teacher' ? (
                <p className="rounded-2xl px-4 py-2.5 text-xs font-bold dark:text-purple-300" style={{ background: 'color-mix(in srgb, var(--energy-violet) 10%, transparent)', color: 'var(--energy-violet)' }}>
                  👩‍🏫 Teacher accounts go straight to your class dashboard — no learner questionnaire needed.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="rounded-2xl px-4 py-2.5 text-xs font-bold dark:text-blue-300" style={{ background: 'color-mix(in srgb, var(--energy-blue) 10%, transparent)', color: 'var(--energy-blue)' }}>
                    🎓 Students answer a short questionnaire so lessons match your learning style.
                  </p>
                  {/* School mode: grade-based enrollment, auto-linked to the teacher's class. */}
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                    <span>
                      <span className="block text-sm font-bold text-[var(--ink)]">🏫 {arabic ? 'أنا طالب في مدرسة' : 'I am a school student'}</span>
                      <span className="block text-[11px] text-[var(--muted)]">{arabic ? 'سيتم ربطك تلقائياً بصف معلمك' : 'Auto-connects you to your teacher\'s class'}</span>
                    </span>
                    <input type="checkbox" checked={formData.schoolMode} onChange={(e) => update('schoolMode', e.target.checked)} className="h-5 w-5 accent-blue-600" />
                  </label>
                </div>
              )}

              <div>
                <label htmlFor="reg-name" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{t.fullName}</label>
                <input id="reg-name" type="text" autoComplete="name" value={formData.name} onChange={(e) => update('name', e.target.value)} placeholder="Maya Chen" className={`brand-input ${errors.name ? 'border-red-400' : ''}`} />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{t.email}</label>
                <input id="reg-email" type="email" autoComplete="email" inputMode="email" value={formData.email} onChange={(e) => update('email', e.target.value)} placeholder="maya@email.com" className={`brand-input ${errors.email ? 'border-red-400' : ''}`} />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {formData.role === 'student' && (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                  {formData.schoolMode ? (
                    <div>
                      <label htmlFor="reg-grade" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{arabic ? 'صفك الدراسي' : 'Your grade'}</label>
                      <select id="reg-grade" value={formData.grade} onChange={(e) => update('grade', e.target.value)} className={`brand-input ${errors.grade ? 'border-red-400' : ''}`}>
                        {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g, arabic)}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-[var(--muted)]">{arabic ? 'يربطك بصف معلمك تلقائياً' : "Links you to your teacher's class automatically"}</p>
                      {errors.grade && <p className="mt-1 text-xs text-red-500">{errors.grade}</p>}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="reg-age" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{t.age}</label>
                      <input id="reg-age" type="number" inputMode="numeric" value={formData.age} onChange={(e) => update('age', e.target.value)} placeholder="10" min="6" max="16" className={`brand-input ${errors.age ? 'border-red-400' : ''}`} />
                      {errors.age && <p className="mt-1 text-xs text-red-500">{errors.age}</p>}
                    </div>
                  )}
                  <div>
                    <label htmlFor="reg-subject" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{arabic ? 'المادة المفضلة' : 'Favorite subject'}</label>
                    <input id="reg-subject" type="text" list="subject-suggestions" value={formData.subject} onChange={(e) => update('subject', e.target.value)} placeholder="Science" className="brand-input" />
                    <datalist id="subject-suggestions">
                      {SUBJECT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{arabic ? 'تُستخدم في توليد الدروس والاختبارات' : 'Feeds your lessons, quizzes & tutor'}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div>
                  <label htmlFor="reg-password" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{t.password}</label>
                  <input id="reg-password" type="password" autoComplete="new-password" value={formData.password} onChange={(e) => update('password', e.target.value)} placeholder="••••••" className={`brand-input ${errors.password ? 'border-red-400' : ''}`} />
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{t.confirmPassword}</label>
                  <input id="reg-confirm" type="password" autoComplete="new-password" value={formData.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="••••••" className={`brand-input ${errors.confirmPassword ? 'border-red-400' : ''}`} />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button type="submit" disabled={loading} className="brand-btn-primary w-full py-3.5 text-base disabled:opacity-60">{loading ? (arabic ? 'جارٍ الإنشاء…' : 'Creating account…') : t.registerButton}</button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {t.haveAccount}{' '}
                <Link to="/login" className="font-bold text-blue-600 transition-standard hover:text-blue-700 dark:text-blue-400">{t.loginHere}</Link>
              </p>
            </div>
          </div>
        )}

        {step === 'sen' && (
          <div className="animate-pop-in rounded-lg border border-[var(--line)] p-6 sm:p-8">
            <LearnerQuestionnaire
              lang={lang}
              phase="sen"
              senAnswers={senAnswers}
              varkChoices={varkChoices}
              onSenChange={(id, value) => setSenAnswers((prev) => ({ ...prev, [id]: value }))}
              onVarkChoice={handleVarkChoice}
              onBack={() => setStep('account')}
              onContinue={() => setStep('vark')}
            />
          </div>
        )}

        {step === 'vark' && (
          <div className="animate-pop-in rounded-lg border border-[var(--line)] p-6 sm:p-8">
            <LearnerQuestionnaire
              lang={lang}
              phase="vark"
              senAnswers={senAnswers}
              varkChoices={varkChoices}
              onSenChange={(id, value) => setSenAnswers((prev) => ({ ...prev, [id]: value }))}
              onVarkChoice={handleVarkChoice}
              onBack={() => { setVarkChoices([]); setStep('sen') }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
