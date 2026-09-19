import type { ReactNode } from 'react'
import jobCoachLogo from '../assets/jobcoach-logo.png'

type LayoutProps = {
  children: ReactNode
  currentScreen:
    | 'welcome'
    | 'parsed'
    | 'tailor'
  profileInitials: string | null
  onHomeClick: () => void
}

export function Layout({
  children,
  currentScreen,
  profileInitials,
  onHomeClick,
}: LayoutProps) {

  // Defines the navigation steps displayed in the sidebar.
  const steps = [
    {
      key: 'welcome',
      number: '01',
      title: 'Welcome',
      subtitle: 'Get started',
    },
    {
      key: 'parsed',
      number: '02',
      title: 'Build your resume',
      subtitle: 'See your match',
    },
    {
      key: 'tailor',
      number: '03',
      title: 'Tailor your resume',
      subtitle: 'Add a job',
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
          aria-label="JobCoachAI home"
          onClick={(event) => {
            event.preventDefault()
            onHomeClick()
          }}
        >
          <span className="brand-logo">
            <img
              src={jobCoachLogo}
              alt="JobCoachAI logo"
            />
          </span>

          <span className="brand-name">
            JobCoach<strong>AI</strong>
          </span>
        </a>

        {/* SIDEBAR INTRO */}
        <div className="sidebar-intro">
          <p className="eyebrow">
            Your personal AI Job Coach
          </p>

          <h1>
            Build With
            <br />
            <span>Confidence</span>
          </h1>
        </div>

        {/* NAVIGATION */}
        <nav
          className="stepper"
          aria-label="Application steps"
        >
          {steps.map((step) => {

            // Highlights the step that matches the current page.
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
                  isActive
                    ? 'page'
                    : undefined
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
        {/* Show the profile icon after the user leaves the welcome page. */}
        {profileInitials &&
          currentScreen !== 'welcome' && (
            <button
              className="profile-avatar"
              type="button"
              aria-label="Profile"
              title="Profile"
            >
              {profileInitials}
            </button>
          )}

        {children}
      </section>
    </main>
  )
}