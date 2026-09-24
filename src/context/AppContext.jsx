import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { translations } from '../i18n/translations'
import api from '../services/api'
import { defaultTogglesForProfile, resolveLearningTemplate } from '../utils/learningTemplate'
import { runThemeTransition } from '../utils/themeTransition'

const AppContext = createContext()

function deriveId(email, name) {
  if (!email) {
    return (name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).slice(2, 6)
  }
  return email.toLowerCase().replace(/[^a-z0-9@.]/g, '_')
}

// ── Per-user localStorage helpers ──────────────────────────────────────────
function userKey(userId, base) {
  return userId ? `${base}_${userId}` : null
}

function loadUserJson(userId, base, fallback) {
  const key = userKey(userId, base)
  if (!key) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function saveUserJson(userId, base, value) {
  const key = userKey(userId, base)
  if (key) localStorage.setItem(key, JSON.stringify(value))
}

function removeUserKeys(userId) {
  const bases = ['shaghoof_xp', 'shaghoof_accessibility', 'shaghoof_lang', 'shaghoof_theme']
  bases.forEach((base) => {
    const key = userKey(userId, base)
    if (key) localStorage.removeItem(key)
  })
}

const DEFAULT_TOGGLES = {
  voiceReader: false,
  signLanguage: false,
  highContrast: false,
  largeText: false,
  audioQuiz: false,
  visualQuiz: false,
  dyslexicFont: false,
  lineFocus: false,
  zenMode: false,
  whiteNoise: false,
  sensoryCalm: false,
  dwellClick: false,
  speechNav: false,
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('shaghoof_user')
    return saved ? JSON.parse(saved) : null
  })

  const userId = user?.id || null

  const [lang, setLang] = useState(() => {
    return (userId && loadUserJson(userId, 'shaghoof_lang', null)) || 'en'
  })
  const [theme, setTheme] = useState(() => {
    return (userId && loadUserJson(userId, 'shaghoof_theme', null)) || 'light'
  })
  const [toggles, setToggles] = useState(() => {
    return (userId && loadUserJson(userId, 'shaghoof_accessibility', null)) || { ...DEFAULT_TOGGLES }
  })
  const [xp, setXp] = useState(() => {
    return (userId && loadUserJson(userId, 'shaghoof_xp', null)) || { total: 0, events: [] }
  })

  // Track previous userId to detect login/logout switches
  const prevUserIdRef = useRef(userId)

  // When userId changes (login/logout), reload per-user state
  useEffect(() => {
    const prev = prevUserIdRef.current
    if (prev === userId) return
    prevUserIdRef.current = userId

    if (userId) {
      // Login: load this user's persisted state
      setLang(loadUserJson(userId, 'shaghoof_lang', null) || 'en')
      setTheme(loadUserJson(userId, 'shaghoof_theme', null) || 'light')
      setToggles(loadUserJson(userId, 'shaghoof_accessibility', null) || { ...DEFAULT_TOGGLES })
      setXp(loadUserJson(userId, 'shaghoof_xp', null) || { total: 0, events: [] })
    } else {
      // Logout: reset to defaults
      setLang('en')
      setTheme('light')
      setToggles({ ...DEFAULT_TOGGLES })
      setXp({ total: 0, events: [] })
    }
  }, [userId])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    if (userId) saveUserJson(userId, 'shaghoof_theme', theme)
  }, [theme, userId])

  // Apply language/direction to document
  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = lang === 'ar' ? 'rtl' : 'ltr'
    if (userId) saveUserJson(userId, 'shaghoof_lang', lang)
  }, [lang, userId])

  useEffect(() => {
    const root = document.documentElement
    const template = user && user.role !== 'teacher' ? resolveLearningTemplate(user) : null
    if (template) {
      root.setAttribute('data-core', template.mode)
      root.setAttribute('data-overlay', template.accessibilityProfile)
      root.setAttribute('data-template', template.id)
      root.classList.toggle('text-support-type', template.textSupport || template.accessibilityProfile === 'text')
    } else {
      root.removeAttribute('data-core')
      root.removeAttribute('data-overlay')
      root.removeAttribute('data-template')
      root.classList.remove('text-support-type')
    }
  }, [user])

  // Apply accessibility toggles
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('opendyslexic', !!toggles.dyslexicFont)
    root.classList.toggle('zen-mode', !!toggles.zenMode)
    root.classList.toggle('sensory-calm', !!toggles.sensoryCalm)
    if (toggles.highContrast) {
      root.style.setProperty('--hc', '1')
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    if (toggles.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }
  }, [toggles])

  useEffect(() => {
    if (userId) saveUserJson(userId, 'shaghoof_accessibility', toggles)
  }, [toggles, userId])

  useEffect(() => {
    if (userId) saveUserJson(userId, 'shaghoof_xp', xp)
  }, [xp, userId])

  const awardXp = useCallback((amount, label = '') => {
    const value = Number(amount) || 0
    if (value <= 0) return
    setXp((prev) => ({
      total: prev.total + value,
      events: [...prev.events.slice(-12), { id: Date.now() + Math.random(), amount: value, label, at: Date.now() }],
    }))
  }, [])

  // Effective XP = the larger of backend-synced XP and locally earned XP
  const xpEffective = Math.max(xp.total, Number(user?.xp) || 0)
  const level = Math.max(1, Math.floor(xpEffective / 500) + 1)
  const xpIntoLevel = xpEffective % 500
  const badge = xpEffective >= 1000 ? 'Gold' : xpEffective >= 500 ? 'Silver' : 'Bronze'

  const toggleLang = () => setLang((prev) => (prev === 'en' ? 'ar' : 'en'))
  const toggleTheme = (event) => {
    const next = theme === 'light' ? 'dark' : 'light'
    runThemeTransition(event, next, () => setTheme(next))
  }

  const toggleAccessibility = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const login = (userData) => {
    const withId = {
      ...userData,
      id: userData.id || deriveId(userData.email, userData.name),
    }
    setUser(withId)
    localStorage.setItem('shaghoof_user', JSON.stringify(withId))
    if (withId.role !== 'teacher') {
      const seedKey = `shaghoof_access_seeded_${withId.id}`
      if (!localStorage.getItem(seedKey)) {
        const template = resolveLearningTemplate(withId)
        setToggles((prev) => ({ ...prev, ...defaultTogglesForProfile(template) }))
        localStorage.setItem(seedKey, '1')
      }
    }
    return withId
  }

  const updateUser = (patch) => {
    setUser((current) => {
      if (!current) return current
      const updated = { ...current, ...patch, id: patch.id || patch.user_id || current.id }
      localStorage.setItem('shaghoof_user', JSON.stringify(updated))
      return updated
    })
  }

  const logout = () => {
    const oldId = user?.id
    setUser(null)
    localStorage.removeItem('shaghoof_user')
    // Clear all per-user localStorage keys for this user
    if (oldId) removeUserKeys(oldId)
    // Reset state to defaults
    setLang('en')
    setTheme('light')
    setToggles({ ...DEFAULT_TOGGLES })
    setXp({ total: 0, events: [] })
  }

  // refresh twin data from backend into the user record.
  const refreshProfile = useCallback(async () => {
    if (!user || !user.id) return null
    try {
      const prof = await api.getProfile(user.id)
      // Never let the student twin store demote a teacher session
      // (getProfile defaults role to "student" for unknown/teacher ids).
      const isTeacher = user.role === 'teacher' || String(user.id).startsWith('teacher-')
      const role = isTeacher ? 'teacher' : (prof.role || user.role || 'student')
      const updated = {
        ...user,
        ...prof,
        role,
        name: prof.name || user.name,
        email: prof.email || user.email,
        subjects: prof.subjects?.length ? prof.subjects : user.subjects || [],
        dataSources: prof.data_sources?.length ? prof.data_sources : user.dataSources || [],
      }
      setUser(updated)
      localStorage.setItem('shaghoof_user', JSON.stringify(updated))
      return updated
    } catch {
      return null
    }
  }, [user])

  const t = translations[lang]

  const value = {
    lang,
    setLang,
    toggleLang,
    theme,
    toggleTheme,
    user,
    login,
    logout,
    updateUser,
    refreshProfile,
    t,
    toggles,
    setToggles,
    toggleAccessibility,
    xpTotal: xp.total,
    xpEffective,
    xpEvents: xp.events,
    level,
    xpIntoLevel,
    badge,
    awardXp,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

export { deriveId }
