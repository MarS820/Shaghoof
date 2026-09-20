import { flushSync } from 'react-dom'

export function shouldReduceThemeMotion() {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  return document.documentElement.getAttribute('data-overlay') === 'structure'
}

export function runThemeTransition(event, nextTheme, apply) {
  if (shouldReduceThemeMotion()) {
    apply()
    return
  }

  const x = event?.clientX ?? window.innerWidth - 48
  const y = event?.clientY ?? 28
  document.documentElement.style.setProperty('--theme-x', `${x}px`)
  document.documentElement.style.setProperty('--theme-y', `${y}px`)
  document.documentElement.setAttribute('data-theme-to', nextTheme)

  const finish = () => {
    document.documentElement.removeAttribute('data-theme-to')
  }

  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(() => {
      flushSync(apply)
    })
    transition.finished.finally(finish)
    return
  }

  const veil = document.createElement('div')
  veil.className = `theme-veil theme-veil-${nextTheme}`
  veil.style.setProperty('--theme-x', `${x}px`)
  veil.style.setProperty('--theme-y', `${y}px`)
  document.body.appendChild(veil)
  requestAnimationFrame(() => veil.classList.add('is-running'))
  window.setTimeout(() => {
    apply()
  }, 320)
  window.setTimeout(() => {
    veil.classList.add('is-done')
  }, 520)
  window.setTimeout(() => {
    veil.remove()
    finish()
  }, 980)
}
