// Layout.tsx
// Shared page shell used across all screens.
// This component holds the overall application frame:
// - top navigation bar for the three-step flow
// - branded header area
// - single content region where each page is rendered
// The intent is to keep the design layout simple and consistent while allowing
// screen switching via hash-based routing in App.tsx.

import type { ReactNode } from 'react'

type LayoutProps = {
  children: ReactNode
  currentScreen: 'welcome' | 'tailor' | 'parsed'
}

export function Layout({ children, currentScreen }: LayoutProps) {
  return (
    <main className="app-shell">
      <header className="top-navbar" aria-label="Workflow navigation">
        <div className="top-navbar-inner">
          <a className="brand" href="#welcome" aria-label="JobCoach AI home">
            <span className="brand-mark">JC</span>
            <span>
              JobCoach <strong>AI</strong>
            </span>
          </a>

          <nav className="stepper" aria-label="Application steps">
            {[
              { key: 'welcome', number: '01', title: 'Welcome', subtitle: 'Get started' },
              { key: 'tailor', number: '02', title: 'Tailor', subtitle: 'Add a job' },
              { key: 'parsed', number: '03', title: 'Your fit', subtitle: 'See your match' },
            ].map((step) => (
              <a
                key={step.key}
                className={`step ${currentScreen === step.key ? 'active' : ''}`}
                data-step={step.key}
                href={`#${step.key}`}
              >
                <span className="step-number">{step.number}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.subtitle}</small>
                </span>
              </a>
            ))}
          </nav>

          <p className="sidebar-footer">
            Built for the next chapter <span aria-hidden="true">→</span>
          </p>
        </div>
      </header>

      <section className="content" aria-live="polite">
        <div className="topbar">
          <span className="topbar-label">Job application workspace</span>
          <span className="secure-note">
            <span className="status-dot" />
            Your data stays yours
          </span>
        </div>

        {children}
      </section>
    </main>
  )
}
