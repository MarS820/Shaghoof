import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useApp } from './context/AppContext'
import Navbar from './components/Navbar'
import XPRain from './components/XPRain'
import RetentionLayer from './components/RetentionLayer'
import BreakPage, { useBreakTimer } from './components/BreakPage'
import LineFocusRuler from './components/accessibility/LineFocusRuler'
import DwellClickSimulator from './components/accessibility/DwellClickSimulator'
import SpeechNavController from './components/accessibility/SpeechNavController'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Teacher from './pages/Teacher'
import Exam from './pages/Exam'
import VarkQuiz from './pages/VarkQuiz'
import LessonHub from './pages/LessonHub'
import LessonTutor from './pages/LessonTutor'
import Flashcards from './pages/Flashcards'
import MoodleConnect from './pages/MoodleConnect'
import Profile from './pages/Profile'
import StretchZone from './pages/StretchZone'
import Settings from './pages/Settings'
import { layerClassNames, resolveLearningTemplate } from './utils/learningTemplate'

function App() {
  const { theme, user, toggles, lang } = useApp()
  const template = user && user.role !== 'teacher' ? resolveLearningTemplate(user) : null
  const arabic = lang === 'ar'
  const { showBreak, dismissBreak } = useBreakTimer()
  // Soft blue mesh with a touch of warm orange/beige — lowered opacity for readability.
  const pageBg =
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'noise\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/><feColorMatrix type=\'saturate\' values=\'0\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23noise)\' opacity=\'0.12\'/></svg>"),' +
    'radial-gradient(90% 55% at 8% 6%, rgba(255,183,144,0.30) 0%, rgba(255,183,144,0.16) 38%, transparent 72%),' +
    'radial-gradient(75% 50% at 88% 8%, rgba(165,180,252,0.34) 0%, rgba(165,180,252,0.16) 40%, transparent 75%),' +
    'radial-gradient(55% 40% at 100% 28%, rgba(125,211,252,0.30) 0%, rgba(125,211,252,0.14) 45%, transparent 78%),' +
    'radial-gradient(72% 58% at 48% 46%, rgba(96,165,250,0.28) 0%, rgba(96,165,250,0.20) 42%, transparent 78%),' +
    'radial-gradient(52% 42% at 12% 38%, rgba(191,219,254,0.26) 0%, rgba(191,219,254,0.14) 48%, transparent 80%),' +
    'radial-gradient(48% 36% at 88% 55%, rgba(129,140,248,0.24) 0%, rgba(129,140,248,0.12) 48%, transparent 80%),' +
    'radial-gradient(40% 35% at 8% 78%, rgba(244,228,204,0.34) 0%, rgba(244,228,204,0.18) 50%, transparent 82%),' +
    'radial-gradient(35% 28% at 18% 92%, rgba(255,196,154,0.26) 0%, rgba(255,196,154,0.14) 50%, transparent 80%),' +
    'radial-gradient(75% 48% at 55% 100%, rgba(147,197,253,0.28) 0%, rgba(147,197,253,0.16) 45%, transparent 78%),' +
    'radial-gradient(50% 40% at 100% 100%, rgba(230,214,188,0.28) 0%, rgba(230,214,188,0.14) 50%, transparent 80%),' +
    'linear-gradient(180deg, #f4f1ea 0%, #e8eef8 24%, #dbeafe 48%, #d9e2f5 72%, #f5ead8 100%)'
  // The active nav tab "hangs" from the capsule into the content window while
  // at the top of the page; once scrolled it retracts (pure presentation).
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={`min-h-screen text-[var(--ink)] ${theme === 'dark' ? 'dark' : ''} ${template ? layerClassNames(template) : ''}`}
      style={{
        background: pageBg,
      }}
      data-core={template?.mode || ''}
      data-overlay={template?.accessibilityProfile || ''}
      data-template={template?.id || ''}
    >
      <div className={scrolled ? 'capsule-scrolled' : ''}>
        <Navbar />
      </div>
      <main className="min-h-[calc(100vh-4.2rem)] pb-16 md:pb-0 px-4 py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/vark-quiz" element={<VarkQuiz />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lessons" element={<LessonHub />} />
          <Route path="/tutor" element={<LessonTutor />} />
          <Route path="/exam" element={<Exam />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/stretch" element={<StretchZone />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/moodle" element={<MoodleConnect />} />
          <Route path="/teacher" element={<Teacher />} />
        </Routes>
      </main>
      {user && user.role !== 'teacher' && <XPRain />}
      <RetentionLayer />
      {/* Break overlay — shows after 20 minutes of activity */}
      {user && showBreak && <BreakPage onDismiss={dismissBreak} />}
      {/* Global SEN accessibility overlays (ported from SHAGHOOF-AI-main) */}
      <LineFocusRuler enabled={!!toggles.lineFocus} />
      <DwellClickSimulator enabled={!!toggles.dwellClick} />
      {user && <SpeechNavController enabled={!!toggles.speechNav} arabic={arabic} lang={lang} />}
    </div>
  )
}

export default App
