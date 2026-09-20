import { useState, useEffect } from 'react'

const MOODS = {
  happy: { emoji: '😊', image: '/brand/mascot-happy.png' },
  excited: { emoji: '🤩', image: '/brand/mascot-excited.png' },
  thinking: { emoji: '🤔', image: '/brand/mascot-happy.png' },
  proud: { emoji: '😎', image: '/brand/mascot-excited.png' },
  waving: { emoji: '👋', image: '/brand/mascot-waving.png' },
  celebrating: { emoji: '🎉', image: '/brand/mascot-excited.png' },
  teaching: { emoji: '📚', image: '/brand/mascot-main.png' },
  sleeping: { emoji: '😴', image: '/brand/mascot-idle.png' },
  idle: { emoji: '🙂', image: '/brand/mascot-idle.png' },
  surprised: { emoji: '😮', image: '/brand/mascot-excited.png' },
  love: { emoji: '😍', image: '/brand/mascot-excited.png' },
  star: { emoji: '⭐', image: '/brand/mascot-happy.png' },
  angry: { emoji: '😠', image: '/brand/mascot-angry.png' },
}

export default function Mascot({ size = 80, animate = true, mood = 'happy', className = '', onInteract }) {
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)
  const [currentMood, setCurrentMood] = useState(mood)

  useEffect(() => { setCurrentMood(mood) }, [mood])

  useEffect(() => {
    if (clicked) {
      const reactions = ['excited', 'celebrating', 'love', 'star']
      setCurrentMood(reactions[Math.floor(Math.random() * reactions.length)])
      const t = setTimeout(() => { setClicked(false); setCurrentMood(mood) }, 1000)
      return () => clearTimeout(t)
    }
  }, [clicked, mood])

  const moodData = MOODS[currentMood] || MOODS.happy

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { setClicked(true); onInteract?.() }}
      style={{ cursor: animate ? 'pointer' : 'default' }}
    >
      {clicked && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl animate-pop-in z-10">
          {moodData.emoji}
        </div>
      )}
      <div className={`${animate ? 'animate-mascot-bounce' : ''} ${hovered ? 'scale-105' : ''} transition-transform duration-200`}>
        <img
          src={moodData.image}
          alt="Shaghoof mascot"
          width={size}
          height={size}
          className="mascot-art object-contain"
          onError={(event) => { event.currentTarget.src = '/brand/shaghoof-mark-clear.png' }}
          style={{ width: size, height: size, objectFit: 'contain' }}
        />
      </div>
      {mood && (
        <div
          className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center shadow-sm"
          style={{ width: size * 0.28, height: size * 0.28, fontSize: size * 0.18 }}
        >
          {moodData.emoji}
        </div>
      )}
    </div>
  )
}
