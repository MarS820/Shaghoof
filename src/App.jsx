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
import QuizGenerator from './pages/QuizGenerator'
import Flashcards from './pages/Flashcards'
import AssignmentGenerator from './pages/AssignmentGenerator'
import PodcastPlayer from './pages/PodcastPlayer'
import FeynmanChallenge from './pages/FeynmanChallenge'
import KnowledgeGraph from './pages/KnowledgeGraph'
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
      className={`min-h-screen bg-[var(--page)] text-[var(--ink)] ${theme === 'dark' ? 'dark' : ''} ${template ? layerClassNames(template) : ''}`}
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
          <Route path="/quiz-generator" element={<QuizGenerator />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/assignments" element={<AssignmentGenerator />} />
          <Route path="/podcast" element={<PodcastPlayer />} />
          <Route path="/feynman" element={<FeynmanChallenge />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
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
