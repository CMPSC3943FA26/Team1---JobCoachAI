import type { ReactNode } from 'react'
import jobCoachLogo from '../assets/jobcoach-logo.png'

type LayoutProps = {
  children: ReactNode
  currentScreen: 'welcome' | 'tailor' | 'parsed'
  isGuest: boolean
  onHomeClick: () => void
}

export function Layout({
  children,
  currentScreen,
  isGuest,
  onHomeClick,
}: LayoutProps) {
  const steps = [
    {
      key: 'welcome',
      number: '01',
      title: 'Welcome',
      subtitle: 'Get started',
    },
    {
      key: 'tailor',
      number: '02',
      title: 'Tailor',
      subtitle: 'Add a job',
    },
    {
      key: 'parsed',
      number: '03',
      title: 'Your fit',
      subtitle: 'See your match',
    },
  ] as const

  return (
    <main className="app-shell">
      {/* LEFT SIDEBAR */}
      <aside
        className="sidebar"
        aria-label="Workflow navigation"
      >
        {/* BRAND */}
        <a
          className="brand"
          href="#welcome"
          aria-label="JobCoach AI home"
          onClick={(event) => {
            event.preventDefault()
            onHomeClick()
          }}
        >
          <span className="brand-logo">
            <img
              src={jobCoachLogo}
              alt="JobCoach AI logo"
            />
          </span>

          <span className="brand-name">
            JobCoach <strong>AI</strong>
          </span>
        </a>

        {/* SIDEBAR INTRO */}
        <div className="sidebar-intro">
          <p className="eyebrow">
            Your personal AI Job Coach
          </p>

          <h1>
            Build your resume with
            <br />
            <span>confidence</span>
          </h1>
        </div>

        {/* NAVIGATION */}
        <nav
          className="stepper"
          aria-label="Application steps"
        >
          {steps.map((step) => {
            const isActive =
              currentScreen === step.key

            return (
              <a
                key={step.key}
                href={`#${step.key}`}
                className={`step ${
                  isActive ? 'active' : ''
                }`}
                aria-current={
                  isActive ? 'page' : undefined
                }
              >
                <span className="step-number">
                  {step.number}
                </span>

                <span className="step-text">
                  <strong>
                    {step.title}
                  </strong>

                  <small>
                    {step.subtitle}
                  </small>
                </span>
              </a>
            )
          })}
        </nav>

        {/* SIDEBAR FOOTER */}
        <p className="sidebar-footer">
          Built for the next chapter
          <span aria-hidden="true">
            →
          </span>
        </p>
      </aside>

      {/* RIGHT SIDE CONTENT */}
      <section
        className="content"
        aria-live="polite"
      >
      {isGuest && currentScreen !== 'welcome' && (
        <div
          className="guest-indicator"
          aria-label="Guest user"
          title="Guest"
        >
          G
        </div>
      )}

        {children}
      </section>
    </main>
  )
}