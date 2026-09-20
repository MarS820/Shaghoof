import { useState } from 'react'
import api from '../services/api'

/**
 * ReverseFeynmanModal — Student teaches back a concept (Reverse Feynman Challenge).
 * Evaluates simplicity, jargon usage, and the "Grandma Test".
 */
export default function ReverseFeynmanModal({ open, onClose, lang = 'en', onXp }) {
  const [topic, setTopic] = useState('')
  const [explanation, setExplanation] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState(null)
  const arabic = lang === 'ar'

  const evaluate = async () => {
    if (!topic.trim() || !explanation.trim()) return
    setEvaluating(true)
    try {
      const data = await api.evaluateFeynman({
        topic: topic.trim(),
        student_explanation: explanation.trim(),
        language: lang,
      })
      setResult(data)
      if (data.xp_earned) onXp?.(data.xp_earned, arabic ? 'تحدي فاينمان' : 'Feynman Challenge')
    } catch (e) {
      console.error('Feynman evaluation failed:', e)
    } finally {
      setEvaluating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="animate-pop-in w-full max-w-lg rounded-3xl border-2 border-amber-300 bg-white p-6 shadow-2xl dark:border-amber-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-amber-700 dark:text-amber-300">
            🎓 {arabic ? 'تحدي فاينمان' : 'Reverse Feynman Challenge'}
          </h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {arabic ? 'اشرح المفهوم بلغة بسيطة كأنك تشرحها لحد مش متخصص' : 'Explain a concept in simple language as if teaching someone unfamiliar with it'}
        </p>

        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={arabic ? 'الموضوع... مثلاً: التمرير الخلفي' : 'Topic... e.g.: Backpropagation'}
          className="mb-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-amber-950 dark:text-white"
          disabled={evaluating}
        />

        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder={arabic ? 'اشرح ببساطة...' : 'Explain simply...'}
          rows={4}
          className="mb-3 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-amber-950 dark:text-white"
          disabled={evaluating}
        />

        <button
          onClick={evaluate}
          disabled={!topic.trim() || !explanation.trim() || evaluating}
          className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {evaluating ? (arabic ? 'جاري التقييم...' : 'Evaluating...') : (arabic ? 'قيّم شرحي' : 'Evaluate My Explanation')}
        </button>

        {result && (
          <div className="mt-4 space-y-3">
            {/* Score */}
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white ${
                result.grandma_test_passed ? 'bg-green-500' : 'bg-amber-500'
              }`}>
                {result.simplicity_score}
              </div>
              <div>
                <p className="text-sm font-extrabold text-[var(--ink)]">{result.verdict}</p>
                <p className="text-[10px] text-gray-500">
                  {result.word_count} {arabic ? 'كلمة' : 'words'} · {result.jargon_count} {arabic ? 'مصطلح تقني' : 'jargon terms'}
                </p>
              </div>
            </div>

            {/* Feedback */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs text-amber-700 dark:text-amber-300">{result.feedback}</p>
            </div>

            {/* Details */}
            <div className="flex flex-wrap gap-2">
              {result.has_analogy && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                  ✅ {arabic ? 'يحتوي تشبيه' : 'Has analogy'}
                </span>
              )}
              {result.grandma_test_passed ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                  ✅ {arabic ? 'اجتاز اختبار الجدة' : 'Grandma Test passed'}
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900 dark:text-red-300">
                  ❌ {arabic ? 'لم يجتز اختبار الجدة' : 'Grandma Test failed'}
                </span>
              )}
              {result.detected_jargons?.length > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                  ⚠️ {result.detected_jargons.join(', ')}
                </span>
              )}
            </div>

            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
              +{result.xp_earned} XP
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
