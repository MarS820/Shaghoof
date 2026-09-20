import { useState, useEffect } from 'react'
import api from '../../services/api'
import AnimatedCard from '../AnimatedCard'

export default function TeacherMisconceptions({ teacherId, classId, lang }) {
  const arabic = lang === 'ar'
  const [bins, setBins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.misconceptions(teacherId, classId)
      .then(setBins)
      .catch(() => setBins([]))
      .finally(() => setLoading(false))
  }, [teacherId, classId])

  if (loading) return <div className="py-8 text-center text-gray-400">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold text-blue-700 dark:text-blue-300">
        {arabic ? 'المفاهيم الخاطئة' : 'Misconception Bins'}
      </h2>
      {bins.length === 0 ? (
        <p className="text-sm text-gray-400">{arabic ? 'لا توجد مفاهيم خاطئة' : 'No misconception data'}</p>
      ) : (
        <div className="space-y-3">
          {bins.map((bin, i) => (
            <AnimatedCard key={i} delay={i * 0.05}>
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-white">{bin.misconception}</span>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {bin.occurrences} {arabic ? 'مرة' : 'occurrences'}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {bin.average_score}%
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bin.students.map((name, j) => (
                  <span key={j} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {name}
                  </span>
                ))}
              </div>
            </div>
            </AnimatedCard>
          ))}
        </div>
      )}
    </div>
  )
}
