/**
 * LanguageToggle — Switches between English and Arabic (with Egyptian dialect option).
 * Used across the app for bilingual support.
 */
export default function LanguageToggle({ lang, setLang, dialect, setDialect }) {
  const arabic = lang === 'ar'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLang(arabic ? 'en' : 'ar')}
        className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] transition-bouncy hover:scale-105 hover:border-[var(--brand)]"
        title={arabic ? 'Switch to English' : 'التبديل إلى العربية'}
      >
        {arabic ? '🇬🇧 EN' : '🇪🇬 AR'}
      </button>

      {arabic && (
        <button
          onClick={() => setDialect(!dialect)}
          className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-bouncy hover:scale-105 ${
            dialect
              ? 'border border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-900 dark:text-green-300'
              : 'border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
          }`}
          title={dialect ? 'اللهجة المصرية' : 'العربية الفصحى'}
        >
          {dialect ? '🇪🇬 عامية' : '📖 فصحى'}
        </button>
      )}
    </div>
  )
}
