import { useState } from 'react'

export default function AnimatedCard({ children, className = '', delay = 0, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`
        animate-pop-in
        ${hovered ? 'scale-[1.02] shadow-lg shadow-blue-200/50 dark:shadow-blue-900/20' : 'shadow-sm'}
        ${onClick ? 'cursor-pointer' : ''}
        transition-bouncy
        ${className}
      `}
      style={{ animationDelay: `${delay}s`, animationFillMode: 'both' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
