import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Mascot from '../components/Mascot'
import ScrollReveal from '../components/ScrollReveal'


export default function Home() {
  const { t, user, lang } = useApp()
  const arabic = lang === 'ar'

  const features = [
    { icon: '🎙️', title: t.feature1Title, desc: t.feature1Desc, color: 'bg-[var(--energy-blue)]', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: '🖐️', title: t.feature2Title, desc: t.feature2Desc, color: 'bg-[var(--energy-violet)]', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { icon: '🎯', title: t.feature3Title, desc: t.feature3Desc, color: 'bg-[var(--energy-mint)]', bg: 'bg-green-50 dark:bg-green-900/20' },
    { icon: '👁️', title: t.feature4Title, desc: t.feature4Desc, color: 'bg-[var(--energy-orange)]', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { icon: '🎮', title: t.feature5Title, desc: t.feature5Desc, color: 'bg-[var(--energy-pink)]', bg: 'bg-pink-50 dark:bg-pink-900/20' },
    { icon: '📊', title: t.feature6Title, desc: t.feature6Desc, color: 'bg-[var(--energy-cyan)]', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  ]

  const steps = [
    { num: '01', title: t.howStep1Title, desc: t.howStep1Desc, icon: '✨', color: 'bg-[var(--energy-blue)]' },
    { num: '02', title: t.howStep2Title, desc: t.howStep2Desc, icon: '📚', color: 'bg-[var(--energy-violet)]' },
    { num: '03', title: t.howStep3Title, desc: t.howStep3Desc, icon: '🚀', color: 'bg-[var(--energy-orange)]' },
  ]

  return (
    <div>
      {/* Hero — wide brand artwork with fade-to-content veil */}
      <section className="home-hero" aria-label={t.heroTitle}>
        <img
          src="/brand/home-bg-wide.png"
          alt="Shaghoof — A joyful learning companion for curious minds"
          className="home-hero-img"
          draggable={false}
          loading="eager"
        />
        <div className="home-hero-cta-wrap animate-fade-in-up">
          {user ? (
            <Link to="/dashboard" className="home-hero-cta">
              {arabic ? 'اذهب إلى لوحتك' : 'Go to your Dashboard'} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <Link to="/register" className="home-hero-cta">
              {t.heroCta1} <span aria-hidden="true">✨</span>
            </Link>
          )}
        </div>
      </section>

      {/* Features — scroll-reveal with staggered children */}
      <ScrollReveal>
        <section id="features" className="relative -mt-12 pt-20 pb-20 home-sky-bg">
          <div className="mx-auto max-w-[92rem] px-4 sm:px-8 lg:px-12">
            <ScrollReveal variant="scale">
              <div className="text-center mb-14">
                <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl dark:text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                  {t.featuresTitle}
                </h2>
                <p className="mt-4 text-lg text-gray-400 dark:text-gray-500">{t.featuresSubtitle}</p>
              </div>
            </ScrollReveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 scroll-stagger">
              {features.map((f, i) => (
                <ScrollReveal key={i} variant="scale">
                  <div className="home-glass-card p-7 feature-card h-full">
                    <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${f.bg} text-3xl`}>
                      {f.icon}
                    </div>
                    <h3 className="mb-2 text-lg font-extrabold text-gray-800 dark:text-gray-100" style={{ fontFamily: 'var(--font-heading)' }}>{f.title}</h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* How It Works — scroll-reveal with staggered children */}
      <ScrollReveal>
        <section className="py-20 home-sky-bg">
          <div className="mx-auto max-w-[92rem] px-4 sm:px-8 lg:px-12">
            <ScrollReveal variant="scale">
              <div className="text-center mb-14">
                <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl dark:text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t.howTitle}</h2>
              </div>
            </ScrollReveal>
            <div className="grid gap-8 sm:grid-cols-3 scroll-stagger">
              {steps.map((s, i) => (
                <ScrollReveal key={i} variant={i === 0 ? 'left' : i === 2 ? 'right' : 'scale'}>
                  <div className="home-glass-card p-10 text-center relative overflow-hidden h-full">
                    <div className="text-5xl mb-5">{s.icon}</div>
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full ${s.color} text-sm font-extrabold text-white shadow-lg`}>{s.num}</div>
                    <h3 className="mb-3 text-lg font-extrabold text-gray-800 dark:text-gray-100" style={{ fontFamily: 'var(--font-heading)' }}>{s.title}</h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* CTA */}
      {!user && (
        <ScrollReveal variant="scale">
          <section className="py-20 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--energy-blue), var(--energy-violet))' }}>
            <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 relative z-10">
              <div className="mb-6 mascot-float"><Mascot size={80} animate mood="excited" /></div>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>Ready to Start Your Journey?</h2>
              <p className="mt-4 text-lg text-blue-100">Join thousands of students learning their way.</p>
              <Link to="/register" className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-10 py-4 text-base font-bold shadow-2xl transition-bouncy hover:scale-105" style={{ color: 'var(--energy-blue)' }}>
                Get Started Free ✨
              </Link>
            </div>
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          </section>
        </ScrollReveal>
      )}

      {/* Footer */}
      <ScrollReveal>
        <footer className="border-t border-white/10 py-10">
          <div className="mx-auto max-w-[92rem] px-4 text-center sm:px-8 lg:px-12">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Mascot size={28} animate={false} mood={null} />
              <span className="text-base font-extrabold dark:text-blue-400" style={{ fontFamily: 'var(--font-heading)', color: 'var(--energy-blue)' }}>Shaghoof</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t.footerRights}</p>
            <p className="mt-1 text-xs text-gray-300 dark:text-gray-600 max-w-lg mx-auto">{t.footerAbout}</p>
          </div>
        </footer>
      </ScrollReveal>
    </div>
  )
}
