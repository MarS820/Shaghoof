import { useMemo, useState } from 'react'
import { LIKERT, SEN_ITEMS, VARK_ITEMS, scoreLearnerScreen } from '../utils/learnerScreening'

const SEN_PAGE_SIZE = 6

export default function LearnerQuestionnaire({ lang = 'en', phase, senAnswers, varkChoices, onSenChange, onVarkChoice, onBack, onContinue, continueLabel }) {
  const arabic = lang === 'ar'
  const [senPage, setSenPage] = useState(0)

  const senPages = useMemo(() => {
    const pages = []
    for (let index = 0; index < SEN_ITEMS.length; index += SEN_PAGE_SIZE) {
      pages.push(SEN_ITEMS.slice(index, index + SEN_PAGE_SIZE))
    }
    return pages
  }, [])

  if (phase === 'sen') {
    const pageItems = senPages[senPage]
    const answeredOnPage = pageItems.every((item) => senAnswers[item.id] !== null && senAnswers[item.id] !== undefined)
    const totalPages = senPages.length
    return (
      <div>
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {arabic
            ? 'هذا استبيان دعم تعليمي مستند إلى أطر بحثية، وليس تشخيصاً طبياً. اختر ما يشبهك في الصف.'
            : 'This is a research-based learning-support screen, not a medical diagnosis. Choose what school feels like for you.'}
        </p>
        <div className="mb-4 flex gap-2" aria-label={arabic ? `صفحة ${senPage + 1} من ${totalPages}` : `Page ${senPage + 1} of ${totalPages}`}>
          {senPages.map((_, index) => (
            <div key={index} className={`h-2 flex-1 rounded-full ${index <= senPage ? 'bg-violet-600' : 'bg-violet-100 dark:bg-gray-800'}`} />
          ))}
        </div>
        <ol className="space-y-4">
          {pageItems.map((item, index) => (
            <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {senPage * SEN_PAGE_SIZE + index + 1}. {arabic ? item.ar : item.en}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LIKERT.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSenChange(item.id, option.value)}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold transition-standard ${
                      senAnswers[item.id] === option.value
                        ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-900/40 dark:text-violet-200'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-violet-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'
                    }`}
                  >
                    {arabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => (senPage === 0 ? onBack() : setSenPage((page) => page - 1))}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            {arabic ? 'رجوع' : 'Back'}
          </button>
          <button
            type="button"
            disabled={!answeredOnPage}
            onClick={() => (senPage < totalPages - 1 ? setSenPage((page) => page + 1) : onContinue())}
            className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {senPage < totalPages - 1 ? (arabic ? 'التالي' : 'Next') : (continueLabel || (arabic ? 'التالي: أسلوب التعلم' : 'Next: learning style'))}
          </button>
        </div>
      </div>
    )
  }

  const step = varkChoices.length
  const prompt = VARK_ITEMS[step]
  const preview = scoreLearnerScreen(senAnswers, varkChoices)
  if (!prompt) return null

  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
        {arabic ? `سؤال VARK ${step + 1} من ${VARK_ITEMS.length}` : `VARK item ${step + 1} of ${VARK_ITEMS.length}`}
      </p>
      <div className="mb-4 flex gap-2">
        {VARK_ITEMS.map((_, index) => (
          <div key={index} className={`h-2 flex-1 rounded-full ${index <= step ? 'bg-violet-600' : 'bg-violet-100 dark:bg-gray-800'}`} />
        ))}
      </div>
      <h2 className="mb-5 text-xl font-extrabold text-gray-900 dark:text-white">{arabic ? prompt.ar : prompt.en}</h2>
      <div className="grid gap-3">
        {Object.entries(prompt.options).map(([style, copy]) => (
          <button
            key={style}
            type="button"
            onClick={() => onVarkChoice(style)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-start text-sm font-semibold text-gray-800 transition-standard hover:border-violet-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {arabic ? copy.ar : copy.en}
          </button>
        ))}
      </div>
      {preview.hasSen && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          {arabic ? 'دعم الاحتياجات الخاصة له أولوية أعلى من أسلوب VARK في الواجهة.' : 'SEN support will take priority over VARK in the interface.'}
        </p>
      )}
      <button type="button" onClick={onBack} className="mt-5 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400">
        {arabic ? 'رجوع' : 'Back'}
      </button>
    </div>
  )
}
