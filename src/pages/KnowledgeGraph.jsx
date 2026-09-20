import { useState } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'


export default function KnowledgeGraph() {
  const { user } = useApp()
  const [courseId, setCourseId] = useState('')
  const [loading, setLoading] = useState(false)
  const [graph, setGraph] = useState(null)

  const fetchGraph = async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const res = await api.getKnowledgeGraph(courseId)
      setGraph(res)
    } catch {
      setGraph(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={48} animate mood="happy" className="mascot-float" />
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Knowledge Graph</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Visualize learning concepts and their relationships</p>
        </div>
      </div>

      {!graph ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Course ID</label>
            <input type="text" value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="Enter course or subject ID..." className="w-full brand-input" />
          </div>
          <button onClick={fetchGraph} disabled={!courseId || loading} className="w-full brand-btn-primary py-3 disabled:opacity-40">
            {loading ? 'Loading...' : 'View Knowledge Graph'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-[var(--line)] rounded-lg p-6">
            {graph.concepts && graph.concepts.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-extrabold text-blue-700 dark:text-blue-300 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Concepts ({graph.concepts.length})</h2>
                {graph.concepts.map((c, i) => (
                  <div key={i} className="brand-tag bg-blue-50 p-3 dark:bg-blue-900/20">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{c.name || c.concept || JSON.stringify(c)}</p>
                    {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                    {c.connections && c.connections.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.connections.map((conn, j) => (
                          <span key={j} className="brand-tag">
                            {typeof conn === 'string' ? conn : conn.name || 'related'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No concepts found for this course.</p>
              </div>
            )}
          </div>
          <button onClick={() => setGraph(null)} className="w-full brand-btn-ghost py-3">
            Search Another Course
          </button>
        </div>
      )}
    </div>
  )
}
