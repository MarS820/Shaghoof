import { useState, useEffect } from 'react'
import api from '../services/api'

/**
 * WordwallEmbed — displays an embedded Wordwall activity from a resource URL.
 * Uses the oEmbed API to fetch embed data and displays it in an iframe.
 * 
 * Props:
 * - url: Wordwall resource or play URL
 * - templateId: Optional template ID for styling
 * - arabic: Arabic language mode
 * - onXp: XP award callback
 */
export default function WordwallEmbed({ url, templateId = 'T3', arabic = false, onXp }) {
  const [embedData, setEmbedData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) {
      setError('No URL provided')
      setLoading(false)
      return
    }

    const fetchEmbedData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await api.fetchWordwallOembed(url)
        
        if (response.valid) {
          setEmbedData(response)
        } else {
          setError(response.error || 'Failed to load Wordwall activity')
        }
      } catch (err) {
        console.error('Failed to fetch Wordwall embed:', err)
        setError('Failed to load Wordwall activity')
      } finally {
        setLoading(false)
      }
    }

    fetchEmbedData()
  }, [url])

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-800" />
          <div className="flex-1">
            <div className="h-4 w-3/4 rounded bg-blue-200 dark:bg-blue-800" />
            <div className="mt-1 h-3 w-1/2 rounded bg-blue-200 dark:bg-blue-800" />
          </div>
        </div>
        <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">
          {arabic ? 'جاري تحميل النشاط...' : 'Loading activity...'}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <div className="flex items-center gap-2">
          <span className="text-red-500">⚠️</span>
          <p className="text-xs font-bold text-red-700 dark:text-red-300">
            {arabic ? 'فشل تحميل النشاط' : 'Failed to load activity'}
          </p>
        </div>
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        {url && (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            {arabic ? 'فتح في Wordwall' : 'Open in Wordwall'} ↗
          </a>
        )}
      </div>
    )
  }

  if (!embedData) {
    return null
  }

  return (
    <div className="animate-pop-in mt-3 rounded-2xl border-2 border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
          🎮 {embedData.title || 'Wordwall Activity'}
          <span className="ms-2 rounded-full bg-blue-200 px-2 py-0.5 text-[9px] font-extrabold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {templateId}
          </span>
        </p>
        {embedData.author && (
          <span className="text-[9px] text-blue-600 dark:text-blue-400">
            by {embedData.author}
          </span>
        )}
      </div>
      
      {/* Embedded iframe */}
      <div className="relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800">
        {embedData.html ? (
          <div 
            className="w-full"
            dangerouslySetInnerHTML={{ __html: embedData.html }}
            style={{ 
              maxWidth: '100%',
              aspectRatio: `${embedData.width || 500} / ${embedData.height || 380}`
            }}
          />
        ) : embedData.embed_url ? (
          <iframe
            src={embedData.embed_url}
            className="w-full border-0"
            style={{ 
              height: `${embedData.height || 380}px`,
              maxWidth: '100%'
            }}
            allowFullScreen
            title={embedData.title || 'Wordwall Activity'}
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-blue-100 dark:bg-blue-900">
            <p className="text-xs text-blue-600 dark:text-blue-300">
              {arabic ? 'المعاينة غير متاحة' : 'Preview not available'}
            </p>
          </div>
        )}
      </div>
      
      {/* Footer with link */}
      <div className="mt-2 flex items-center justify-between">
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          {arabic ? 'فتح في Wordwall' : 'Open in Wordwall'} ↗
        </a>
        <button
          onClick={() => onXp?.(5, arabic ? 'نشاط Wordwall' : 'Wordwall Activity')}
          className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          +5 XP
        </button>
      </div>
    </div>
  )
}


/**
 * WordwallSuggestion — displays a suggested Wordwall activity type
 * with an option to search for it on Wordwall.
 */
export function WordwallSuggestion({ suggestion, arabic = false }) {
  const { type, reason } = suggestion
  
  // Map activity type to Wordwall search URL
  const getSearchUrl = (type) => {
    const searchTerms = {
      'match': 'match up',
      'matching': 'matching pairs',
      'truefalse': 'true false',
      'quiz': 'quiz',
      'multiplechoice': 'multiple choice',
      'wordsearch': 'word search',
      'crossword': 'crossword',
      'anagram': 'anagram',
      'wheel': 'wheel',
      'randomwheel': 'random wheel',
      'groupsort': 'group sort',
      'ranking': 'ranking',
      'labelleddiagram': 'labelled diagram',
      'flashcards': 'flashcards',
      'typeanswer': 'type answer',
      'airplane': 'airplane',
      'unjumble': 'unjumble',
    }
    const term = searchTerms[type] || type
    return `https://wordwall.net/community/search?q=${encodeURIComponent(term)}`
  }
  
  const activityNames = {
    'match': { en: 'Match Up', ar: 'مطابقة' },
    'matching': { en: 'Matching Pairs', ar: 'أزواج متطابقة' },
    'truefalse': { en: 'True or False', ar: 'صح أم خطأ' },
    'quiz': { en: 'Quiz', ar: 'اختبار' },
    'multiplechoice': { en: 'Multiple Choice', ar: 'اختيار متعدد' },
    'wordsearch': { en: 'Word Search', ar: 'بحث عن كلمات' },
    'crossword': { en: 'Crossword', ar: 'كROSSword' },
    'anagram': { en: 'Anagram', ar: 'تشفير حروف' },
    'wheel': { en: 'Spin the Wheel', ar: 'عجلة الدوران' },
    'randomwheel': { en: 'Random Wheel', ar: 'عجلة عشوائية' },
    'groupsort': { en: 'Group Sort', ar: 'تصنيف المجموعات' },
    'ranking': { en: 'Ranking', ar: 'ترتيب' },
    'labelleddiagram': { en: 'Labelled Diagram', ar: 'رسم مُعلَّم' },
    'flashcards': { en: 'Flashcards', ar: 'بطاقات تعليمية' },
    'typeanswer': { en: 'Type the Answer', ar: 'اكتب الإجابة' },
    'airplane': { en: 'Airplane', ar: 'طائرة' },
    'unjumble': { en: 'Unjumble', ar: 'ترتيب الكلمات' },
  }
  
  const name = activityNames[type]?.[arabic ? 'ar' : 'en'] || type
  
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {arabic ? 'نشاط مقترح:' : 'Suggested activity:'} {name}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">
            {reason}
          </p>
        </div>
        <a
          href={getSearchUrl(type)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          {arabic ? 'بحث' : 'Search'} ↗
        </a>
      </div>
    </div>
  )
}
