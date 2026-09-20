import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AccountMenu from './AccountMenu'
import api from '../services/api'
import Dock from './Dock'
import NotificationBell from './NotificationBell'
import ModalOverlay from './ModalOverlay'
import { getBadgeName } from '../constants/badges'
import { useState, useRef, useEffect, lazy, Suspense } from 'react'

const LazyProfile = lazy(() => import('../pages/Profile'))
const LazySettings = lazy(() => import('../pages/Settings'))

// Floating capsule navigation (pitch-style):
//  - The bar is a floating dark capsule; the ACTIVE destination renders as a
//    raised white tab whose bottom corners melt into the page (inverted /
//    concave corner fillets — pure CSS, see .capsule-tab in index.css).
//  - Inactive destinations are small ghost pills inside the capsule.
//  - ALL practice tools collapse into one "Practice" dropdown; Profile /
//    Settings live in the avatar menu; a ⋯ overflow covers narrow viewports.
//  - The mobile bottom tab bar (students) is unchanged.
const CORE_TABS = [
  { path: '/dashboard', label: 'Dashboard', ar: 'لوحتي', icon: '🏠' },
  { path: '/lessons', label: 'My Courses', ar: 'دروسي', icon: '📚' },
  { path: '/tutor', label: 'Learn', ar: 'تعلّم', icon: '🧠' },
  { path: '/exam', label: 'Quizzes', ar: 'اختبارات', icon: '✏️' },
  { path: '/flashcards', label: 'Flashcards', ar: 'بطاقات', icon: '🃏' },
  { path: '/stretch', label: 'Stretch Zone', ar: 'منطقة التحدي', icon: '🧗' },
]

const TEACHER_TABS = [
  { path: '/teacher', label: 'Teacher Panel', ar: 'لوحة المعلم', icon: '👥' },
  { path: '/settings', label: 'Settings', ar: 'إعدادات', icon: '⚙️' },
]

const MOBILE_TABS = [
  { path: '/dashboard', label: 'Home', ar: 'الرئيسية', icon: '🏠' },
  { path: '/lessons', label: 'Courses', ar: 'دروسي', icon: '📚' },
  { path: '/tutor', label: 'Learn', ar: 'تعلّم', icon: '🧠' },
  { path: '/exam', label: 'Quiz', ar: 'اختبار', icon: '✏️' },
  { path: '/profile', label: 'Profile', ar: 'ملفي', icon: '🧑‍🎓' },
]

export default function Navbar() {
  const { t, user, logout, theme, toggleTheme, lang, toggleLang, toggles, setToggles, level, xpIntoLevel, xpEffective } = useApp()
  const arabic = lang === 'ar'
  const badgeTierName = getBadgeName(xpEffective, lang, arabic)
  const [moreOpen, setMoreOpen] = useState(false)
  const [modalPage, setModalPage] = useState(null) // 'profile' | 'settings' | null
  const moreRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isStudent = !!user && user.role !== 'teacher'
  const isTeacher = user?.role === 'teacher'

  useEffect(() => {
    const onDoc = (event) => {
      if (moreRef.current && !moreRef.current.contains(event.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Zeigarnik effect hook (master plan: Retention Psychology) — before logout,
  // the backend leaves an unfinished micro-goal the student wants to finish.
  const handleLogout = async () => {
    let hookMessage = null
    if (user && user.id) {
      try {
        const res = await api.logoutHook({ user_id: user.id, questions_answered: 0, total: 5 })
        hookMessage = res?.message || res?.text || null
      } catch {}
    }
    if (hookMessage && window.confirm(`${hookMessage}\n\n${arabic ? 'تسجيل الخروج الآن؟' : 'Log out anyway?'}`)) {
      logout()
      navigate('/')
      return
    }
    if (!window.confirm(arabic ? 'تسجيل الخروج؟' : 'Log out?')) return
    logout()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path
  const toggleSensory = () => setToggles((prev) => ({ ...prev, sensoryCalm: !prev.sensoryCalm }))
  const closeAll = () => { setMoreOpen(false) }

  const tabs = isTeacher ? TEACHER_TABS : isStudent ? CORE_TABS : []

  // ⋯ overflow: destinations not visible as pills on the current layout.
  // smHide items are only needed below the `sm` breakpoint (their pill twins
  // become visible in the tab row from `sm` up).
  let overflow = []
  if (isStudent) {
    overflow = [
      ...CORE_TABS.map((l) => ({ ...l, smHide: true })),
      { path: '/moodle', label: 'LMS Connect', ar: 'ربط LMS', icon: '🎓' },
      { onClick: () => { closeAll(); setModalPage('profile') }, label: 'Profile', ar: 'ملفي', icon: '🧑‍🎓' },
      { onClick: () => { closeAll(); setModalPage('settings') }, label: 'Settings', ar: 'إعدادات', icon: '⚙️' },
    ]
  } else if (isTeacher) {
    overflow = TEACHER_TABS.map((l) => ({ ...l, smHide: true }))
  } else {
    overflow = [
      { path: '/login', label: t.login, ar: t.login, icon: '🔑' },
      { path: '/register', label: t.getStarted, ar: t.getStarted, icon: '🚀' },
    ]
  }

  const renderLabel = (item) => (arabic && item.ar ? item.ar : item.label)

  return (
    <>
      <nav className="app-navbar capsule-nav" aria-label={arabic ? 'التنقل الرئيسي' : 'Main navigation'}>
        <div className="capsule-bar">
          {/* Left cluster: dock tabs */}
          <div className="relative shrink">
            <Dock
              className="capsule-tabs"
              items={[
                ...tabs.map((link) => ({
                  icon: <span className="capsule-ico" aria-hidden="true">{link.icon}</span>,
                  label: renderLabel(link),
                  href: link.path,
                  active: isActive(link.path),
                })),
              ]}
              iconSize={44}
              magnification={1.8}
              distance={140}
              gap={20}
              borderRadius={14}
            />
          </div>

          {/* Center: logo + name */}
          <Link to="/" className="capsule-logo capsule-logo-center" aria-label="Shaghoof home">
            <img src="/brand/shaghoof-wordmark-clear.png" alt="Shaghoof" className="h-7 w-auto object-contain md:h-9" style={{ minWidth: 80 }} />
          </Link>

          {/* Tools cluster */}
          <div className="capsule-tools">
            {isStudent && (
              <div className="capsule-xp" title={`Level ${level} · ${badgeTierName}`}>
                <span aria-hidden="true">⭐</span> Lv {level}
                <span className="h-1.5 w-10 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--energy-orange) 25%, transparent)' }}>
                  <span
                    className="block h-full rounded-full transition-all duration-500"
                    style={{ width: `${(xpIntoLevel / 500) * 100}%`, background: 'linear-gradient(90deg, #fff, var(--energy-sunshine))' }}
                  />
                </span>
                <span className="rounded-full px-1.5 text-[9px] uppercase tracking-wide" style={{ background: 'color-mix(in srgb, var(--energy-orange) 25%, transparent)' }}>{badgeTierName}</span>
              </div>
            )}
            {isStudent && (
              <button
                onClick={toggleSensory}
                className={`capsule-iconbtn ${toggles.sensoryCalm ? 'on' : ''}`}
                title={arabic ? 'تقليل الحركة والألوان' : 'Sensory load: reduce motion & color'}
                aria-pressed={!!toggles.sensoryCalm}
              >
                🌿
              </button>
            )}
            {isStudent && <NotificationBell />}
            <button onClick={toggleLang} className="capsule-iconbtn" title={arabic ? 'Switch to English' : 'التبديل إلى العربية'} aria-pressed={arabic}>
              {arabic ? '🇬🇧' : '🇪🇬'}
            </button>
            <button onClick={toggleTheme} className="capsule-iconbtn" title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {user ? (
              <div className="shrink-0">
                <AccountMenu onLogout={handleLogout} />
              </div>
            ) : (
              <>
                <Link to="/login" className="capsule-pill capsule-auth">{t.login}</Link>
                <Link to="/register" className="capsule-pill capsule-pill-cta capsule-auth">{t.getStarted}</Link>
              </>
            )}

            {/* Overflow ⋯ — carries everything that doesn't fit the pill row.
                Always rendered (guests need mobile access to Login too);
                hidden on ≥640px only where the pills row already shows all. */}
            <div className={`relative shrink-0 capsule-more ${isStudent ? '' : 'capsule-desktop-hide'}`} ref={moreRef}>
                <button
                  type="button"
                  onClick={() => { setMoreOpen((v) => !v) }}
                  className="capsule-iconbtn"
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  aria-label={arabic ? 'المزيد' : 'More'}
                >
                  {moreOpen ? '✕' : '⋯'}
                </button>
                {moreOpen && (
                  <div className="capsule-overflow end-0" role="menu">
                    {overflow.map((item, idx) =>
                      item.header ? (
                        <p key={`h-${idx}`} className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider opacity-50">
                          {renderLabel(item)}
                        </p>
                      ) : item.onClick ? (
                        <button
                          key={item.label}
                          onClick={item.onClick}
                          className={`capsule-menu-item ${item.smHide ? 'capsule-sm-only' : ''}`}
                          role="menuitem"
                        >
                          <span aria-hidden="true">{item.icon}</span> {renderLabel(item)}
                        </button>
                      ) : (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={closeAll}
                          className={`capsule-menu-item ${item.smHide ? 'capsule-sm-only' : ''} ${isActive(item.path) ? 'active' : ''}`}
                          role="menuitem"
                        >
                          <span aria-hidden="true">{item.icon}</span> {renderLabel(item)}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — 5 fixed destinations (master plan main tabs) */}
      {isStudent && (
        <nav className="app-tabbar fixed bottom-0 inset-x-0 z-50 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)] zen-hide">
          <div className="grid grid-cols-5">
            {MOBILE_TABS.map((tab) => {
              const active = isActive(tab.path)
              return (
                <Link key={tab.path} to={tab.path} className={`tabbar-item flex flex-col items-center gap-0.5 py-2 ${active ? 'active text-[var(--brand)]' : 'text-[var(--muted)]'}`}>
                  <span className="text-xl" aria-hidden="true">{tab.icon}</span>
                  <span className="text-[10px] font-bold">{arabic ? tab.ar : tab.label}</span>
                  <span className="tabbar-dot h-1 w-1 rounded-full bg-[var(--brand)]" />
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      {/* Profile / Settings popup overlays */}
      {modalPage && (
        <ModalOverlay onClose={() => setModalPage(null)} title={modalPage === 'profile' ? (arabic ? 'ملفي الشخصي' : 'Profile') : (arabic ? 'الإعدادات' : 'Settings')}>
          <Suspense fallback={<div className="py-8 text-center text-sm text-[var(--muted)]">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>}>
            {modalPage === 'profile' ? <LazyProfile /> : <LazySettings />}
          </Suspense>
        </ModalOverlay>
      )}
    </>
  )
}
