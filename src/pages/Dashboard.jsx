import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Mascot from '../components/Mascot'
import BrainWheel from '../components/BrainWheel'
import TemplateRevealPopup from '../components/TemplateRevealPopup'
import { BADGE_TIERS, getCurrentBadge, getNextBadge } from '../constants/badges'
import api from '../services/api'

const AFFIRMATIONS = [
  { en: 'Every small step counts. Keep going! 🌟', ar: 'كل خطوة صغيرة تُحسب. استمر! 🌟' },
  { en: 'Your brain grows every time you try. 🌱', ar: 'دماغك ينمو كل مرة تحاول. 🌱' },
  { en: 'You learn differently — and that is your superpower. 🦸', ar: 'أنت تتعلم بطريقة مختلفة — وهذه قوتك الخارقة. 🦸' },
  { en: 'Mistakes are proof that you are trying. 💪', ar: 'الأخطاء دليل أنك تحاول. 💪' },
]

const VARK_COPY = {
  visual: { en: 'Visual', ar: 'البصري' },
  auditory: { en: 'Auditory', ar: 'السمعي' },
  reading: { en: 'Reading', ar: 'القرائي' },
  kinesthetic: { en: 'Kinesthetic', ar: 'الحركي' },
}

function getMoodActivities(mood, arabic, lessons) {
  if (lessons.length === 0) return []
  const moodConfig = {
    great: { kind: 'stretch', icon: '🤸', verb: arabic ? 'تحدَّ في' : 'Stretch:', detail: arabic ? 'تحدي يتطلب تفكيرًا عميقًا لتعزيز تعلمك' : 'A deeper challenge to strengthen your learning', minutes: 15 },
    ok: { kind: 'lesson', icon: '🧠', verb: arabic ? 'تعلّم' : 'Learn:', detail: arabic ? 'درس مخصص' : 'Customized lesson', minutes: 12 },
    low: { kind: 'practice', icon: '☕', verb: arabic ? 'راجع' : 'Review:', detail: arabic ? 'مراجعة خفيفة بدون ضغط' : 'Light review at your own pace', minutes: 5 },
  }
  const m = moodConfig[mood] || moodConfig.ok
  return lessons.slice(0, 3).map((l) => ({
    title: `${m.verb} ${l.title}`,
    detail: l.summary || m.detail,
    icon: m.icon,
    minutes: m.minutes,
    link: `/tutor?lesson=${encodeURIComponent(l.session_id)}`,
    kind: m.kind,
  }))
}

export default function Dashboard() {
  const { user, lang, awardXp, xpEffective, level, xpIntoLevel, refreshProfile, updateUser } = useApp()
  const [profile, setProfile] = useState(null)
  const [brainwheel, setBrainwheel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkIn, setCheckIn] = useState(() => !sessionStorage.getItem('shaghoof_emotion_today'))
  const [mood, setMood] = useState(null)
  const [need, setNeed] = useState(null)
  const [activityFeed, setActivityFeed] = useState([])
  const [dailyPlan, setDailyPlan] = useState(null)
  const [lessons, setLessons] = useState([])
  const [breakRem, setBreakRem] = useState(false)
  const [showReveal, setShowReveal] = useState(() => {
    if (localStorage.getItem('shaghoof_show_reveal') === '1') {
      localStorage.removeItem('shaghoof_show_reveal')
      return true
    }
    return false
  })

  const arabic = lang === 'ar'
  const subjects = user?.subjects || []
  const sources = user?.dataSources || []; const profileSubjects = profile?.subjects || [];
  const profileSources = profile?.data_sources || [];
  const hasData = (subjects.length > 0 || profileSubjects.length > 0) || (sources.length > 0 || profileSources.length > 0) || (dailyPlan?.courses?.length > 0) || lessons.length > 0

  // Refetch functions for real-time updates
  const refetchPlan = async () => {
    if (!user?.id) return
    try {
      const res = await api.dailyPlan(user.id, lang)
      setDailyPlan(res)
    } catch { /* offline-safe */ }
  }

  const refetchBrainwheel = async () => {
    if (!user?.id) return
    try {
      const res = await api.brainwheel(user.id)
      setBrainwheel(res)
    } catch { /* offline-safe */ }
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) { setLoading(false); return }
      try {
        const [profileRes, wheelRes, feedRes, planRes, lessonsRes] = await Promise.all([
          api.getProfile(user.id).catch(() => null),
          api.brainwheel(user.id).catch(() => null),
          api.activityFeed(user.id).catch(() => null),
          api.dailyPlan(user.id, lang).catch(() => null),
          api.listLessons(user.id).catch(() => null),
        ])
        // Merge the authoritative backend profile into the app so the saved
        // progress (enrolled classes, VARK, badges, mood check-ins) is visible.
        if (profileRes && user?.id) {
          updateUser({
            ...profileRes,
            subjects: profileRes.subjects?.length ? profileRes.subjects : (user.subjects || []),
            dataSources: profileRes.data_sources?.length ? profileRes.data_sources : (user.dataSources || []),
          })
        }
        setProfile(profileRes)
        setBrainwheel(wheelRes)
        setActivityFeed(feedRes?.feed || [])
        setDailyPlan(planRes)
        setLessons(lessonsRes?.lessons || [])
      } catch {} finally { setLoading(false) }
    }
    fetchData()
    // Depend only on user id + lang. `user.vark` must NOT be a dependency:
    // updateUser() replaces it with a fresh object each fetch, which would
    // re-run this effect forever and flood the API (429s / bad requests).
  }, [user?.id, lang])

  // Auto-refresh plan every 5 minutes to stay in sync with backend
  useEffect(() => {
    if (!user?.id) return
    const timer = window.setInterval(refetchPlan, 5 * 60_000)
    return () => window.clearInterval(timer)
  }, [user?.id, lang])

  // 15-minute continuous-work break reminder (retention loop)
  useEffect(() => {
    if (!user?.id) return undefined
    const check = async () => {
      try {
        const res = await api.breakReminder({ user_id: user.id, active: true })
        if (res?.reminder) setBreakRem(true)
      } catch { /* offline-safe */ }
    }
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [user?.id])

  const displayXp = xpEffective
  const streak = profile?.streak || user?.streak || 0
  const badgeTiers = BADGE_TIERS.map((t) => ({ ...t, name: arabic ? t.ar : t.name }))
  const currentBadge = [...badgeTiers].reverse().find((tier) => displayXp >= tier.xp) || badgeTiers[0]
  const nextBadge = badgeTiers.find((tier) => tier.xp > displayXp)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? (arabic ? 'صباح الخير' : 'Good morning') : hour < 17 ? (arabic ? 'مساء الخير' : 'Good afternoon') : (arabic ? 'مساء الخير' : 'Good evening')
  const firstName = (user?.name || (arabic ? 'يا بطل' : 'Student')).split(' ')[0]

  // Hero goal: grow the weakest VARK style (wireframe: "Improve Auditory skills 45% → 60%")
  const varkEntries = Object.entries(user?.vark || {}).filter(([k]) => ['visual', 'auditory', 'reading', 'kinesthetic'].includes(k) && Number.isFinite(Number(user.vark[k])))
  const weakest = varkEntries.length ? varkEntries.reduce((a, b) => (Number(a[1]) <= Number(b[1]) ? a : b)) : null
  const goalNow = weakest ? Math.round(Number(weakest[1])) : null
  const goalTarget = goalNow !== null ? Math.min(100, goalNow + 15) : null
  const affirmation = AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length][arabic ? 'ar' : 'en']

  const submitCheckIn = async () => {
    if (!mood) return
    sessionStorage.setItem('shaghoof_emotion_today', mood)
    setCheckIn(false)
    awardXp(5, arabic ? 'تسجيل المزاج' : 'Check-in')
    try {
      await api.emotion({ user_id: user.id, mood, need: need || '', source: 'dashboard' })
    } catch { /* offline-safe */ }
  }

  const examHistory = [...(profile?.exam_history || [])].reverse().slice(0, 5)

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl py-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-2xl bg-[var(--line)]" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-3xl bg-[var(--line)]" />)}
          </div>
          <div className="h-40 rounded-3xl bg-[var(--line)]" />
        </div>
      </div>
    )
  }

  const wheelReady = brainwheel?.values?.length === 4

  return (
    <div className="sky-bg mx-auto max-w-7xl">
      {showReveal && <TemplateRevealPopup onClose={() => setShowReveal(false)} />}
      {/* Break reminder banner (SEMH retention loop) */}
      {breakRem && (
        <div className="animate-nudge mb-4 flex items-center justify-between gap-3 rounded-3xl border-2 p-4 dark:from-orange-950/30 dark:to-amber-950/30" style={{ borderColor: 'color-mix(in srgb, var(--energy-orange) 30%, transparent)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--energy-orange) 8%, transparent), color-mix(in srgb, var(--energy-sunshine) 8%, transparent))' }}>
          <p className="text-sm font-extrabold" style={{ color: 'var(--energy-orange)' }}>🧘 {arabic ? 'أنت تتعلم بجدية منذ ١٥ دقيقة — خذ استراحة قصيرة!' : 'You have been learning for 15 minutes — take a short break!'}</p>
          <button onClick={() => setBreakRem(false)} className="rounded-full border-2 px-3 py-1 text-xs font-extrabold transition-bouncy hover:scale-105 press-bubble dark:text-orange-300" style={{ borderColor: 'var(--energy-orange)', color: 'var(--energy-orange)' }} aria-label={arabic ? 'حسناً' : 'Got it'}>{arabic ? 'حسناً!' : 'Got it!'}</button>
        </div>
      )}

      {/* ── Wireframe grid: main column + right rail ─────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ══ LEFT COLUMN ══ */}
        <div className="min-w-0 space-y-4">
          {/* HERO — greeting + goal card + mini Brain Wheel + mascot */}
          <section className="brand-sky-card animate-bubble-in relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
            <div className="relative z-10 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--ink)] sm:text-[1.7rem]" style={{ fontFamily: 'var(--font-heading)' }}>
                  {greeting}{arabic ? '،' : ','} {firstName}! 👋
                </h1>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {hasData ? (arabic ? 'خطوات صغيرة، تقدم كبير. استمر!' : 'Small steps, big progress. Keep going!') : (arabic ? 'ابدأ بإضافة مصادر التعلم.' : 'Start by adding learning sources.')}
                </p>

                {/* Goal card (weakest style → +15%) */}
                {weakest && (
                  <Link to="/stretch" className="group mt-4 block max-w-sm rounded-2xl border border-[var(--line)] bg-white/85 p-3.5 shadow-sm backdrop-blur transition-bouncy hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900/70">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--ink)]">
                        <span className="text-base">🎯</span>
                        {arabic ? `طوّر مهارة ${VARK_COPY[weakest[0]].ar}` : `Improve ${VARK_COPY[weakest[0]].en} skills`}
                      </p>
                      <span className="text-[var(--muted)] transition-bouncy group-hover:translate-x-1">›</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs font-extrabold text-[var(--brand)]">{goalNow}% <span className="font-bold text-[var(--muted)]">→ {goalTarget}%</span></span>
                      <div className="brand-progress flex-1"><div className="brand-progress-fill animate-grow-bar" style={{ width: `${goalNow}%` }} /></div>
                    </div>
                  </Link>
                )}

                {/* Stats chips: level · streak · sources */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold text-[var(--ink)] shadow-sm dark:bg-slate-900/60">⭐ {arabic ? 'المستوى' : 'Level'} {level} <span className="font-bold text-[var(--muted)]">· {xpIntoLevel}/{500} XP</span></span>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold shadow-sm dark:bg-slate-900/60" style={{ color: 'var(--energy-orange)' }}>🔥 {streak} {arabic ? 'أيام' : 'days'}</span>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold text-[var(--ink)] shadow-sm dark:bg-slate-900/60">📚 {sources.length} {arabic ? (sources.length === 1 ? 'مصدر' : 'مصادر') : sources.length === 1 ? 'source' : 'sources'}</span>
                </div>
              </div>

              {/* Mini Brain Wheel + the ORIGINAL mascot, kept as-is */}
              <div className="flex items-center gap-1">
                {wheelReady && (
                  <div className="brainwheel-sm rounded-2xl border border-[var(--line)] bg-white/85 p-2 shadow-sm backdrop-blur dark:bg-slate-900/70">
                    <div className="flex items-center justify-between px-1 pb-0.5">
                      <p className="text-[11px] font-extrabold text-[var(--ink)]">🧠 {arabic ? 'عجلة الدماغ' : 'Brain Wheel'}</p>
                      <Link to="/profile" className="text-[10px] font-bold text-[var(--brand)] hover:underline">{arabic ? 'التفاصيل' : 'Details'} ›</Link>
                    </div>
                    <BrainWheel data={brainwheel} />
                  </div>
                )}
                <Mascot size={96} animate mood="happy" className="animate-bobble shrink-0" />
              </div>
            </div>
          </section>

          {/* PROGRESS BADGE — current badge + all 9 tiers in numerical order */}
          <section className="bubble-card animate-bubble-in p-5">
            {/* Current badge header */}
            <div className="flex items-center gap-4">
              <div className="badge-orbit flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl p-2 shadow-md" style={{ background: 'linear-gradient(135deg, var(--energy-orange), var(--energy-sunshine))' }}>
                <img src={currentBadge.image} alt={currentBadge.name} className="h-full w-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em]" style={{ color: 'var(--energy-orange)' }}>{arabic ? 'شارة تقدمك' : 'Your progress badge'}</p>
                <h2 className="text-lg font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{currentBadge.name}</h2>
                <p className="text-[11px] font-semibold text-[var(--muted)]">
                  {nextBadge ? (arabic ? `${nextBadge.xp - displayXp} XP لفتح ${nextBadge.name}` : `${nextBadge.xp - displayXp} XP to unlock ${nextBadge.name}`) : (arabic ? 'فتحت كل الشارات!' : 'Every badge unlocked!')}
                </p>
              </div>
              <div className="w-28 shrink-0">
                <div className="brand-progress"><div className="brand-progress-fill animate-grow-bar" style={{ width: `${(xpIntoLevel / 500) * 100}%` }} /></div>
                <p className="mt-1 text-end text-[10px] font-bold text-[var(--muted)]">{displayXp} / {level * 500} XP</p>
              </div>
            </div>

            {/* All 9 badges — numerical grid with level ranges */}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {badgeTiers.map((tier, index) => {
                const isUnlocked = displayXp >= tier.xp
                const isCurrent = tier === currentBadge
                return (
                  <div
                    key={tier.xp}
                    className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2.5 text-center transition-bouncy hover:-translate-y-0.5 ${
                      isCurrent
                        ? 'border-orange-400 bg-gradient-to-b from-orange-50 to-amber-100/60 shadow-md dark:from-orange-950/40 dark:to-amber-950/20'
                        : isUnlocked
                          ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'
                          : 'border-[var(--line)] bg-white/40 opacity-50 dark:bg-slate-900/20'
                    }`}
                  >
                    {/* Number badge */}
                    <span className={`absolute -top-2 -end-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold shadow-sm ${
                      isCurrent ? 'text-white' : isUnlocked ? 'text-white' : 'bg-[var(--line)] text-[var(--muted)]'
                    }`} style={isCurrent ? { background: 'var(--energy-orange)' } : isUnlocked ? { background: 'var(--energy-blue)' } : {}}>{index + 1}</span>

                    <img src={tier.image} alt={tier.name} className={`h-10 w-10 object-contain ${!isUnlocked ? 'grayscale' : ''}`} />

                    <p className={`text-[10px] font-extrabold leading-tight ${isCurrent ? 'dark:text-orange-300' : isUnlocked ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`} style={isCurrent ? { color: 'var(--energy-orange)' } : {}}>
                      {tier.name}
                    </p>

                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                      isCurrent ? 'dark:bg-orange-800 dark:text-orange-200' : isUnlocked ? 'dark:bg-slate-800 dark:text-slate-200' : 'bg-[var(--line)] text-[var(--muted)]'
                    }`} style={isCurrent ? { background: 'color-mix(in srgb, var(--energy-orange) 20%, transparent)', color: 'var(--energy-orange)' } : isUnlocked ? { background: 'var(--brand-light)', color: 'var(--brand)' } : {}}>
                      {tier.xp === 0 ? '0 XP' : `${tier.xp}+ XP`}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* TODAY'S PLAN — mood-aware activities */}
          <section className="bubble-card animate-bubble-in p-5">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🗓️ {arabic ? 'خطة اليوم' : "Today's plan"}</h2>
              {mood && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{
                  background: mood === 'great' ? 'color-mix(in srgb, var(--energy-mint) 15%, transparent)' : mood === 'low' ? 'color-mix(in srgb, var(--energy-pink) 15%, transparent)' : 'color-mix(in srgb, var(--energy-blue) 15%, transparent)',
                  color: mood === 'great' ? 'var(--energy-mint)' : mood === 'low' ? 'var(--energy-pink)' : 'var(--energy-blue)',
                }}>
                  {mood === 'great' ? (arabic ? 'ممتاز 🔥' : 'Great 🔥') : mood === 'low' ? (arabic ? 'هدوء 💛' : 'Calm 💛') : (arabic ? 'جيد ⭐' : 'Good ⭐')}
                </span>
              )}
            </div>

            {!mood && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--page)] p-3">
                <Mascot size={32} animate mood="idle" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {arabic ? 'كيف حالك اليوم؟' : 'How are you feeling?'}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {arabic ? 'اختر مزاجك لنخصّص خطتك' : 'Pick your mood to personalize activities'}
                  </p>
                </div>
                <div className="flex gap-1">
                  {[{ id: 'great', e: '😊' }, { id: 'ok', e: '😐' }, { id: 'low', e: '😞' }].map((m) => (
                    <button key={m.id} onClick={() => setMood(m.id)} className="rounded-full border-2 border-transparent px-2 py-1 text-lg transition-bouncy hover:scale-110 press-bubble hover:border-[var(--line)]" aria-label={m.id}>{m.e}</button>
                  ))}
                </div>
              </div>
            )}

            {getMoodActivities(mood || 'ok', arabic, lessons).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {getMoodActivities(mood || 'ok', arabic, lessons).slice(0, 3).map((task, index) => (
                  <article key={task.id || index} className={`bubble-card animate-bubble-in relative p-4 stagger-${index + 1}`}>
                    <span className="absolute start-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-light)] text-[10px] font-extrabold text-[var(--brand)]">{index + 1}</span>
                    <div className="ms-7 text-xl">{task.icon || (task.kind === 'stretch' ? '🤸' : task.kind === 'practice' ? '📝' : '🎯')}</div>
                    <h3 className="mt-2 text-sm font-extrabold text-[var(--ink)]">{task.title}</h3>
                    <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-[var(--muted)]">{task.detail}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--muted)]">⏱ {task.minutes || 10} {arabic ? 'دقيقة' : 'min'}</span>
                      <Link to={task.link || '/tutor'} className="rounded-full bg-[var(--brand)] px-3 py-1 text-[11px] font-extrabold text-white transition-bouncy hover:scale-105 press-bubble">
                        {arabic ? 'ابدأ' : 'Start'}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[var(--line)] p-6 text-center">
                <Mascot size={48} animate mood="idle" className="mx-auto mb-3" />
                <p className="text-sm font-bold text-[var(--ink)]">
                  {arabic ? 'لا توجد دروس بعد' : 'No lessons yet'}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {arabic ? 'أنشئ دروساً من المقالات أو ملفات PDF لتظهر هنا' : 'Create lessons from articles or PDFs to see them here'}
                </p>
                <Link to="/lessons" className="brand-btn-primary mt-3 inline-flex text-xs">
                  {arabic ? 'إنشاء درس' : 'Create a lesson'} →
                </Link>
              </div>
            )}

            <div className="mt-3 rounded-2xl p-2.5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--energy-orange) 10%, transparent), color-mix(in srgb, var(--energy-sunshine) 10%, transparent))' }}>
              <p className="text-[11px] font-bold" style={{ color: 'var(--energy-orange)' }}>💬 {affirmation}</p>
            </div>
          </section>

          {!hasData ? (
            <div className="rounded-3xl border-2 border-dashed border-[var(--line)] p-12 text-center">
              <Mascot size={72} animate mood="waving" className="mx-auto mb-4 animate-bobble" />
              <h2 className="mb-2 text-lg font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{arabic ? 'مرحباً بك في شغوف' : 'Welcome to Shaghoof'}</h2>
              <p className="mx-auto mb-4 max-w-sm text-sm text-[var(--muted)]">{arabic ? 'أضف موضوعات ومصادر في الإعدادات لتفتح تجربة التعلم المخصصة لك.' : 'Add subjects and content in Settings to unlock your personalized learning experience.'}</p>
              <Link to="/settings" className="brand-btn-primary">{arabic ? 'اذهب للإعدادات' : 'Go to Settings'}</Link>
            </div>
          ) : (
            <>
              {/* RECENT RESULTS */}
              {examHistory.length > 0 && (
                <section>
                  <h2 className="mb-3 text-base font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🏆 {arabic ? 'آخر النتائج' : 'Recent results'}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {examHistory.map((exam) => (
                      <div key={exam.id || `${exam.topic}-${exam.date || ''}`} className="bubble-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-bold text-[var(--ink)]">{exam.mode === 'stretch' ? '🌱 ' : '📝 '}{exam.topic}</div>
                          <span className={`rounded-full px-2 py-1 text-xs font-extrabold ${Number(exam.score) >= 60 ? 'dark:text-green-300' : 'dark:text-orange-300'}`} style={Number(exam.score) >= 60 ? { background: 'color-mix(in srgb, var(--energy-mint) 15%, transparent)', color: 'var(--energy-mint)' } : { background: 'color-mix(in srgb, var(--energy-orange) 15%, transparent)', color: 'var(--energy-orange)' }}>{Math.round(Number(exam.score) || 0)}%</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[var(--muted)]">
                          <span>{exam.correct_count}/{exam.total_questions} {arabic ? 'صحيح' : 'correct'}</span>
                          <span>⚡ +{exam.xp_earned || 0} XP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* ══ RIGHT RAIL ══ */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {/* Emotion check-in (SEMH) — compact */}
          {checkIn && user?.role !== 'teacher' && (
            <div className="bubble-card animate-nudge p-4">
              <p className="text-sm font-extrabold" style={{ color: 'var(--energy-pink)' }}>💗 {arabic ? 'كيف حالك اليوم؟' : 'How are you feeling today?'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {[
                  { id: 'great', e: '😊', color: 'var(--mood-great)' },
                  { id: 'ok', e: '😐', color: 'var(--mood-ok)' },
                  { id: 'low', e: '😞', color: 'var(--mood-low)' },
                ].map((m) => (
                  <button key={m.id} onClick={() => setMood(m.id)} className={`rounded-full border-2 px-3 py-1.5 text-lg transition-bouncy hover:scale-110 press-bubble ${mood === m.id ? 'scale-110' : 'border-transparent'}`} style={mood === m.id ? { borderColor: m.color, background: `color-mix(in srgb, ${m.color} 15%, transparent)` } : {}} aria-label={m.id}>{m.e}</button>
                ))}
                {mood && (
                  <>
                    <span className="mx-1 h-5 w-px" style={{ background: 'var(--line)' }} />
                    {[
                      { id: 'calm', e: '☀️', label: arabic ? 'هدوء' : 'Calm', color: 'var(--energy-sunshine)' },
                      { id: 'energy', e: '⚡', label: arabic ? 'طاقة' : 'Energy', color: 'var(--energy-orange)' },
                      { id: 'break', e: '🧘', label: arabic ? 'استراحة' : 'Break', color: 'var(--energy-mint)' },
                    ].map((n) => (
                      <button key={n.id} onClick={() => setNeed(n.id)} className={`rounded-full border-2 px-2.5 py-1 text-xs font-bold transition-bouncy hover:scale-105 press-bubble ${need === n.id ? 'text-white' : ''}`} style={need === n.id ? { borderColor: n.color, background: n.color } : { borderColor: 'var(--line)', color: 'var(--muted)' }}>
                        {n.e} {n.label}
                      </button>
                    ))}
                    <button onClick={submitCheckIn} className="brand-btn-primary ms-auto py-1.5 text-xs">{arabic ? 'تم!' : 'Done!'}</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* MOOD BOARD — persistent mood display */}
          <section className="bubble-card animate-bubble-in p-4">
            <h2 className="text-sm font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>🎭 {arabic ? ' moodك اليوم' : 'Your mood today'}</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{
                background: mood === 'great' ? 'color-mix(in srgb, var(--energy-mint) 15%, transparent)' : mood === 'low' ? 'color-mix(in srgb, var(--energy-pink) 15%, transparent)' : mood === 'ok' ? 'color-mix(in srgb, var(--energy-blue) 15%, transparent)' : 'var(--line)',
              }}>
                {mood === 'great' ? '😊' : mood === 'low' ? '😞' : mood === 'ok' ? '😐' : '❓'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-[var(--ink)]">
                  {mood === 'great' ? (arabic ? 'ممتاز!' : 'Great!') : mood === 'low' ? (arabic ? 'هادئ' : 'Calm') : mood === 'ok' ? (arabic ? 'جيد' : 'Good') : (arabic ? 'لم تسجل بعد' : 'Not checked in')}
                </p>
                <p className="text-[10px] text-[var(--muted)]">
                  {mood ? (arabic ? 'اختر نشاطاً مناسب لمزاجك' : 'Choose activities matching your mood') : (arabic ? 'سجّل مزاجك أعلاه' : 'Check in above')}
                </p>
              </div>
              <button
                onClick={() => { setCheckIn(true); setMood(null); setNeed(null); sessionStorage.removeItem('shaghoof_emotion_today'); }}
                className="rounded-full border-2 px-2.5 py-1 text-[10px] font-bold transition-bouncy hover:scale-105 press-bubble"
                style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
              >
                {mood ? (arabic ? 'غيّر' : 'Change') : (arabic ? 'سجّل' : 'Check in')}
              </button>
            </div>
            {mood && (
              <div className="mt-2 flex gap-1.5">
                {['great', 'ok', 'low'].map((m) => (
                  <div
                    key={m}
                    className={`h-1.5 flex-1 rounded-full transition-bouncy ${mood === m ? 'scale-y-150' : 'opacity-40'}`}
                    style={{
                      background: m === 'great' ? 'var(--energy-mint)' : m === 'low' ? 'var(--energy-pink)' : 'var(--energy-blue)',
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* QUICK ACTIONS — 2×2 */}
          <section className="bubble-card animate-bubble-in p-4">
            <h2 className="text-sm font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>⚡ {arabic ? 'إجراءات سريعة' : 'Quick actions'}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[
                { to: '/tutor', icon: '🧠', label: arabic ? 'المعلّم + الدرس' : 'Learn + Tutor', color: 'var(--energy-violet)' },
                { to: '/exam', icon: '📝', label: arabic ? 'اختبار' : 'Quiz', color: 'var(--energy-blue)' },
                { to: '/flashcards', icon: '🃏', label: arabic ? 'بطاقات' : 'Flashcards', color: 'var(--energy-pink)' },
                { to: '/stretch', icon: '🤸', label: arabic ? 'منطقة التحدي' : 'Stretch Zone', color: 'var(--energy-orange)' },
              ].map((a, i) => (
                <Link key={a.to} to={a.to} className={`group flex flex-col items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--page)] p-3.5 text-center transition-bouncy hover:-translate-y-1 hover:shadow-lg stagger-${i + 1}`} style={{ '--hover-accent': a.color }}>
                  <span className="text-2xl transition-bouncy group-hover:scale-125">{a.icon}</span>
                  <span className="text-[11px] font-bold text-[var(--ink)]">{a.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
