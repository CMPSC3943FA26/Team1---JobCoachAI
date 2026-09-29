import { useEffect, useRef, useState, type ReactNode } from 'react'
import jobCoachLogo from '../assets/jobcoach-logo.png'

type LayoutProps = {
  children: ReactNode
  currentScreen: 'welcome' | 'parsed' | 'tailor' | 'profile'
  profileInitials: string | null
  isGuest: boolean
  accountName?: string | null
  onHomeClick: () => void
  onOpenProfile?: () => void
  onOpenSavedResumes?: () => void
  onLogout?: () => void
}

export function Layout({
  children,
  currentScreen,
  profileInitials,
  isGuest,
  accountName,
  onHomeClick,
  onOpenProfile,
  onOpenSavedResumes,
  onLogout,
}: LayoutProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    setAccountMenuOpen(false)
  }, [currentScreen])

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
      <aside className="sidebar" aria-label="Workflow navigation">
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
            <img src={jobCoachLogo} alt="JobCoachAI logo" />
          </span>

          <span className="brand-name">
            JobCoach<strong>AI</strong>
          </span>
        </a>

        <div className="sidebar-intro">
          <p className="eyebrow">Your personal AI Job Coach</p>
          <h1>
            Build With
            <br />
            <span>Confidence</span>
          </h1>
        </div>

        <nav className="stepper" aria-label="Application steps">
          {steps.map((step) => {
            const isActive = currentScreen === step.key

            return (
              <a
                key={step.key}
                href={`#${step.key}`}
                className={`step ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="step-number">{step.number}</span>
                <span className="step-text">
                  <strong>{step.title}</strong>
                  <small>{step.subtitle}</small>
                </span>
              </a>
            )
          })}
        </nav>

        <p className="sidebar-footer">
          Built for the next chapter
          <span aria-hidden="true">→</span>
        </p>
      </aside>

      <section className="content" aria-live="polite">
        {profileInitials && currentScreen !== 'welcome' && (
          isGuest ? (
            <button
              className="profile-avatar"
              type="button"
              aria-label="Guest"
              title="Guest"
            >
              {profileInitials}
            </button>
          ) : (
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button
                className="account-trigger"
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="profile-avatar account-avatar" aria-hidden="true">
                  {profileInitials}
                </span>
                <span className="account-trigger-name">{accountName || 'User'}</span>
                <span className={`account-chevron ${accountMenuOpen ? 'open' : ''}`} aria-hidden="true">
                 ⌄
                </span>
              </button>

              {accountMenuOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown-heading">
                    <span>Signed in as</span>
                    <strong>{accountName || 'User'}</strong>
                  </div>

                  <button
                    className="account-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onOpenProfile?.()
                    }}
                  >
                    <span aria-hidden="true">♙</span>
                    My Profile
                  </button>

                  <button
                    className="account-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onOpenSavedResumes?.()
                    }}
                  >
                    <span aria-hidden="true">▤</span>
                    Saved Resumes
                  </button>

                  <div className="account-menu-divider" />

                  <button
                    className="account-menu-item account-menu-logout"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onLogout?.()
                    }}
                  >
                    <span aria-hidden="true">↪</span>
                    Log out
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {children}
      </section>
    </main>
  )
}
