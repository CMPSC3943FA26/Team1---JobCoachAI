import type { ReactNode } from 'react'

type LayoutProps = {
  children: ReactNode
  currentScreen: 'welcome' | 'tailor' | 'parsed'
}

export function Layout({ children, currentScreen }: LayoutProps) {
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
        >
          <span className="brand-mark">
            JC
          </span>

          <span className="brand-name">
            JobCoach <strong>AI</strong>
          </span>
        </a>


        {/* SIDEBAR INTRO */}
        <div className="sidebar-intro">

          <p className="eyebrow">
            Your application copilot
          </p>

          <h1>
            Move from
            <br />

            <span>
              maybe
            </span>{' '}

            to ready.
          </h1>

          <p className="sidebar-copy">
            Make every application feel like
            <br />
            it was made for you.
          </p>

        </div>


        {/* NAVIGATION */}
        <nav
          className="stepper"
          aria-label="Application steps"
        >

          {steps.map((step) => {
            const isActive = currentScreen === step.key

            return (
              <a
                key={step.key}
                href={`#${step.key}`}
                className={`step ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
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

        <div className="topbar">

          <span className="topbar-label">
            Job application workspace
          </span>

          <span className="secure-note">

            <span
              className="status-dot"
              aria-hidden="true"
            />

            Your data stays yours

          </span>

        </div>

        {children}

      </section>

    </main>
  )
}