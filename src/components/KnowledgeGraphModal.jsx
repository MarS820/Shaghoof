import { useState, useEffect } from 'react'
import api from '../services/api'
import { useApp } from '../context/AppContext'

/**
 * KnowledgeGraphModal — Interactive concept knowledge graph visualization.
 * Shows nodes (concepts) and edges (relationships) with cluster coloring.
 */
export default function KnowledgeGraphModal({ open, onClose, lang = 'en', onXp }) {
  const { user } = useApp()
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const arabic = lang === 'ar'

  useEffect(() => {
    if (open && !graph) loadGraph()
  }, [open])

  const loadGraph = async () => {
    setLoading(true)
    try {
      const data = await api.getKnowledgeGraph(user?.id || '')
      setGraph(data)
    } catch (e) {
      console.error('Failed to load knowledge graph:', e)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="animate-pop-in w-full max-w-3xl rounded-3xl border-2 border-blue-300 bg-white p-6 shadow-2xl dark:border-blue-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-blue-700 dark:text-blue-300">
            🧠 {arabic ? 'خريطة المعرفة' : 'Knowledge Graph'}
          </h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="text-sm text-gray-500">{arabic ? 'جاري التحميل...' : 'Loading...'}</div>
          </div>
        )}

        {graph && (
          <div className="space-y-4">
            {/* Clusters legend */}
            <div className="flex flex-wrap gap-2">
              {graph.clusters?.map((c) => (
                <span key={c.id} className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: c.color }}>
                  {arabic ? c.name : (graph.nodes?.find(n => n.category === c.id)?.label || c.name)}
                </span>
              ))}
            </div>

            {/* Node list */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {graph.nodes?.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    selectedNode?.id === node.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 bg-gray-50 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-[var(--ink)]">
                        {arabic ? node.labelAr : node.label}
                      </span>
                      <span className="ml-2 rounded-full bg-gray-200 px-1.5 py-0.5 text-[8px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        L{node.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {graph.edges?.filter(e => e.source === node.id || e.target === node.id).map((edge, i) => (
                        <span key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[8px] text-gray-500 dark:bg-gray-700">
                          {edge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedNode && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                <p className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                  {arabic ? selectedNode.labelAr : selectedNode.label}
                </p>
                <p className="mt-1 text-[10px] text-blue-600 dark:text-blue-400">
                  {arabic ? `المستوى ${selectedNode.level} — ${graph.clusters?.find(c => c.id === selectedNode.category)?.name || ''}` : `Level ${selectedNode.level} — ${graph.clusters?.find(c => c.id === selectedNode.category)?.name || ''}`}
                </p>
                <button
                  onClick={() => onXp?.(5, arabic ? 'خريطة المعرفة' : 'Knowledge Graph')}
                  className="mt-2 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
                >
                  +5 XP
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
