import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { resolveLearningTemplate } from '../utils/learningTemplate'

const ROUTES = [
  { path: '/', en: 'Home', ar: 'الرئيسية' },
  { path: '/exam', en: 'Practice', ar: 'تدريب' },
  { path: '/dashboard', en: 'Dashboard', ar: 'لوحة التحكم' },
]

export default function AdaptiveShell({ children, hasSidebar }) {
  const { user, lang } = useApp()
  const location = useLocation()
  const arabic = lang === 'ar'
  const template = user && user.role !== 'teacher' ? resolveLearningTemplate(user) : null
  const overlay = template?.accessibilityProfile || 'general'
  const currentIndex = Math.max(0, ROUTES.findIndex((route) => route.path === location.pathname))

  return (
    <>
      {template && overlay !== 'general' && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <span>
              {arabic ? 'الطبقة الأساسية' : 'Core'} · {template.mode}
              <span className="mx-2 opacity-40">|</span>
              {arabic ? 'طبقة الدعم (أولوية أعلى)' : 'SEN overlay (priority)'} · {overlay}
              <span className="mx-2 opacity-40">|</span>
              {template.name}
            </span>
            {overlay === 'structure' && (
              <span>
                {arabic ? 'أنت هنا' : 'You are here'}: {currentIndex + 1}/{ROUTES.length} — {arabic ? ROUTES[currentIndex]?.ar : ROUTES[currentIndex]?.en}
              </span>
            )}
            {overlay === 'focus' && (
              <span>{arabic ? 'مهمة قصيرة: خطوة واحدة ثم استراحة قصيرة.' : 'Micro-quest: one step, then a short pause.'}</span>
            )}
            {overlay === 'text' && (
              <span>{arabic ? 'خط أوضح ونطق صوتي جاهزان للنص.' : 'Clearer type and speech are ready for text.'}</span>
            )}
          </div>
        </div>
      )}
      <div className={hasSidebar ? 'md:pl-[240px] transition-all duration-300' : ''}>
        <div className="pb-20 md:pb-0">
          {children}
        </div>
      </div>
    </>
  )
}
