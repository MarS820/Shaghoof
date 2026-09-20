import { useApp } from '../context/AppContext'

export default function DarkModeToggle() {
  const { theme, toggleTheme } = useApp()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={(event) => toggleTheme(event)}
      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 transition-standard hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      aria-label={isDark ? 'Switch to Dawn theme' : 'Switch to Dusk theme'}
      title={isDark ? 'Dawn theme' : 'Dusk theme'}
    >
      {isDark ? (
        <svg
          className="h-5 w-5 text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg
          className="h-5 w-5 text-gray-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      <span className="hidden sm:inline">{isDark ? 'Dusk' : 'Dawn'}</span>
    </button>
  )
}
