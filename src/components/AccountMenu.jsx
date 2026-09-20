import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import {
  CORE_OPTIONS,
  OVERLAY_OPTIONS,
  defaultTogglesForProfile,
  previewTemplate,
  resolveLearningTemplate,
  varkWithDominant,
} from '../utils/learningTemplate'

const CORE_COPY = {
  visual: { en: 'Visual', ar: 'بصري' },
  auditory: { en: 'Auditory', ar: 'سمعي' },
  reading: { en: 'Read / Write', ar: 'قرائي' },
  kinesthetic: { en: 'Kinesthetic', ar: 'حركي' },
}

const OVERLAY_COPY = {
  general: { en: 'None (VARK only)', ar: 'بدون دعم (VARK فقط)' },
  text: { en: 'Text support', ar: 'دعم النص' },
  focus: { en: 'Focus support', ar: 'دعم التركيز' },
  structure: { en: 'Structure support', ar: 'دعم البنية' },
}

export default function AccountMenu({ onLogout }) {
  const { user, lang, updateUser, setToggles } = useApp()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const arabic = lang === 'ar'
  const template = user && user.role !== 'teacher' ? resolveLearningTemplate(user) : null
  const [core, setCore] = useState(template?.mode || 'visual')
  const [overlay, setOverlay] = useState(template?.accessibilityProfile || 'general')

  useEffect(() => {
    if (!template) return
    setCore(template.mode)
    setOverlay(template.accessibilityProfile)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync when the resolved template changes
  }, [template?.mode, template?.accessibilityProfile])

  useEffect(() => {
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!user) return null

  const preview = previewTemplate(overlay, core)

  // "Why this template" — explain the two layers that produced the active template.
  const coreWhy = {
    visual: { en: 'your VARK quiz scored Visual highest', ar: 'نتيجة اختبار VARK أنك بصري' },
    auditory: { en: 'your VARK quiz scored Auditory highest', ar: 'نتيجة اختبار VARK أنك سمعي' },
    reading: { en: 'your VARK quiz scored Reading/Writing highest', ar: 'نتيجة اختبار VARK أنك قرائي' },
    kinesthetic: { en: 'your VARK quiz scored Kinesthetic highest', ar: 'نتيجة اختبار VARK أنك حركي' },
  }
  const overlayWhy = {
    general: { en: 'no extra support layer is needed', ar: 'لا تحتاج طبقة دعم إضافية' },
    text: { en: 'your support profile adds text support (clearer typography, simpler wording)', ar: 'ملف الدعم يضيف دعم النص (خط أوضح وصياغة أبسط)' },
    focus: { en: 'your support profile adds focus support (short tasks, fewer distractions)', ar: 'ملف الدعم يضيف دعم التركيز (مهام قصيرة وتشتيت أقل)' },
    structure: { en: 'your support profile adds structure support (predictable steps, literal language)', ar: 'ملف الدعم يضيف دعم البنية (خطوات ثابتة ولغة مباشرة)' },
  }
  const whyText = arabic
    ? `القالب ${preview.id} «${preview.name}» نشط لأن ${overlayWhy[overlay]?.ar || overlayWhy.general.ar}، و${coreWhy[core]?.ar || coreWhy.visual.ar}.`
    : `Template ${preview.id} “${preview.name}” is active because ${overlayWhy[overlay]?.en || overlayWhy.general.en}, and ${coreWhy[core]?.en || coreWhy.visual.en}.`

  const quickLinks = [
    { to: '/profile', icon: '🧑‍🎓', en: 'My Profile', ar: 'ملفي' },
    { to: '/settings', icon: '⚙️', en: 'Settings', ar: 'الإعدادات' },
  ]

  const applyLayers = async (nextOverlay, nextCore) => {
    setOverlay(nextOverlay)
    setCore(nextCore)
    const vark = varkWithDominant(nextCore, user.vark)
    const patch = {
      vark,
      sen_profile: nextOverlay,
      preferred_core: nextCore,
    }
    const nextUser = { ...user, ...patch }
    updateUser(patch)
    const nextTemplate = resolveLearningTemplate(nextUser)
    setToggles((prev) => ({ ...prev, ...defaultTogglesForProfile(nextTemplate) }))
    try {
      await api.updateProfile(user.id, { vark, sen_profile: nextOverlay, preferred_core: nextCore })
    } catch {
      // Local twin still updates; backend can catch up on next successful save.
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={arabic ? 'إعدادات الحساب' : 'Account settings'}
      >
        {(user.name || user.email || '?').charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="absolute end-0 z-[80] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 max-md:relative max-md:end-auto max-md:w-full dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm font-extrabold text-gray-900 dark:text-white">{user.name}</p>
          <p className="mb-3 text-xs text-gray-500">{user.email}</p>
          {user.role !== 'teacher' && (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-600">
                {arabic ? 'مظهر الواجهة' : 'Interface look'}
              </p>
              <p className="mb-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {arabic
                  ? 'طبقة الدعم لها أولوية أعلى. أسلوب VARK يختار القالب داخل تلك الطبقة.'
                  : 'SEN overlay has priority. VARK picks the template inside that overlay.'}
              </p>
              <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{arabic ? 'أسلوب VARK' : 'VARK core'}</p>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {CORE_OPTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyLayers(overlay, key)}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold ${core === key ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
                  >
                    {arabic ? CORE_COPY[key].ar : CORE_COPY[key].en}
                  </button>
                ))}
              </div>
              <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{arabic ? 'طبقة الدعم' : 'SEN overlay'}</p>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {OVERLAY_OPTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyLayers(key, core)}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold ${overlay === key ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
                  >
                    {arabic ? OVERLAY_COPY[key].ar : OVERLAY_COPY[key].en}
                  </button>
                ))}
              </div>
              <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs dark:border-violet-800 dark:bg-violet-950/40">
                <span className="font-bold text-violet-800 dark:text-violet-200">{preview.icon} {preview.id} {preview.name}</span>
                <span className="mt-1 block text-violet-700 dark:text-violet-300">
                  {arabic ? preview.ar : preview.en}
                </span>
                <span className="mt-1.5 block border-t border-violet-200 pt-1.5 text-[11px] leading-relaxed text-violet-600 dark:border-violet-800 dark:text-violet-300">
                  {whyText}
                </span>
              </div>
            </>
          )}
          {user.role !== 'teacher' && (
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {quickLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2 text-xs font-bold text-gray-700 hover:border-violet-400 hover:text-violet-700 dark:border-gray-700 dark:text-gray-200 dark:hover:text-violet-300"
                >
                  <span aria-hidden="true">{l.icon}</span> {arabic ? l.ar : l.en}
                </Link>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400"
          >
            {arabic ? 'تسجيل الخروج' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  )
}
