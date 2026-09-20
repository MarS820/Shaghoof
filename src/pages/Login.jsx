import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

import api from '../services/api'

export default function Login() {
  const { t, login } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    try {
      // Teachers live in a separate SQL store — try that endpoint first.
      // Backend returns { ok, profile }; the old `res.teacher` check never matched.
      const tRes = await api.teacherLogin({ email: email.trim().toLowerCase(), password }).catch(() => null)
      if (tRes?.ok && tRes.profile) {
        const prof = tRes.profile
        login({ ...prof, id: prof.id || prof.user_id || email.trim().toLowerCase(), role: 'teacher' })
        navigate('/teacher')
        return
      }
      // Student accounts: { ok, profile } with profile carrying id/user_id + role.
      const res = await api.login({ email: email.trim(), password })
      const prof = res?.profile || res?.user || res
      login({ ...prof, id: prof.user_id || prof.id || prof.email, role: prof.role || 'student' })
      navigate(prof?.role === 'teacher' ? '/teacher' : '/dashboard')
    } catch {
      setError(t.loginError || 'Invalid email or password.')
    } finally { setLoading(false) }
  }

  const handleForgot = () => {
    setInfo('Password resets are handled by your teacher or guardian. Ask them to reset it for you.')
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left — splash artwork with fade masks top & bottom */}
      <div className="login-splash hidden md:flex md:w-full md:shrink-0 lg:w-1/2 lg:self-stretch">
        <img
          src="/brand/login-art.png"
          alt="Shaghoof mascot studying on a stack of books"
          className="login-splash-img"
        />
      </div>

      {/* Right — login form with clean white backdrop */}
      <div className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:w-1/2 lg:py-12 bg-white dark:bg-[#0D1530]">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="mb-8 text-center md:hidden">
            <div className="login-splash mx-auto mb-4 h-36 w-full max-w-xs overflow-hidden rounded-3xl">
              <img src="/brand/login-art.png" alt="" aria-hidden="true" className="login-splash-img" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-heading)' }}>Shaghoof</h1>
          </div>

          <div className="animate-pop-in">
            <h2 className="mb-2 text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>
              Welcome back! 👋
            </h2>
            <p className="mb-8 text-sm text-gray-400 dark:text-gray-500 sm:text-base">
              Great to see you again. Continue your learning journey.
            </p>

            {error && (
              <div className="animate-pop-in mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-500 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            {info && (
              <div className="animate-pop-in mb-5 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                {info}
              </div>
            )}

            <div className="mb-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500">Students & teachers log in here</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">Email or Username</label>
                <input
                  id="login-email"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@email.com"
                  className="brand-input"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="brand-input pr-12"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-standard hover:text-blue-500">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <div onClick={() => setRemember(!remember)} className={`h-5 w-5 rounded-lg border-2 transition-standard flex items-center justify-center ${remember ? 'border-blue-600 bg-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                    {remember && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Remember me</span>
                </label>
                <button type="button" onClick={handleForgot} className="text-sm font-bold text-blue-600 transition-standard hover:text-blue-700 dark:text-blue-400">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="brand-btn-primary w-full py-3.5 text-base disabled:opacity-60">
                {loading ? 'Logging in...' : 'Log In'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-blue-600 transition-standard hover:text-blue-700 dark:text-blue-400">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
