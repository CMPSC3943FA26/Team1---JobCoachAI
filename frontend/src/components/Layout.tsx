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
  resumePreview?: Record<string, any> | null
  onCloseResumePreview?: () => void
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
  resumePreview,
  onCloseResumePreview,
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
        {resumePreview ? (
          <div className="sidebar-resume-preview">
            <div className="sidebar-resume-preview-topbar">
              <div>
                <p className="eyebrow">Saved resume preview</p>
                <strong>{resumePreview.title || resumePreview.full_name || 'Saved Resume'}</strong>
              </div>
              <button
                className="sidebar-preview-close"
                type="button"
                aria-label="Close resume preview"
                onClick={onCloseResumePreview}
              >
                ×
              </button>
            </div>

            <div className="sidebar-resume-preview-scroll">
              <article className="sidebar-resume-preview-page">
                <header className="sidebar-preview-header">
                  <h2>{resumePreview.full_name || 'Your name'}</h2>
                  {(resumePreview.email || resumePreview.phone || resumePreview.location) && (
                    <p>
                      {[resumePreview.email, resumePreview.phone, resumePreview.location]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </header>

                {resumePreview.professional_summary && (
                  <section>
                    <h3>Professional Summary</h3>
                    <p>{resumePreview.professional_summary}</p>
                  </section>
                )}

                {Array.isArray(resumePreview.work_experience) && resumePreview.work_experience.length > 0 && (
                  <section>
                    <h3>Experience</h3>
                    {[...resumePreview.work_experience]
                      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                      .map((item: any, index: number) => (
                        <div className="sidebar-preview-entry" key={item.id ?? index}>
                          <strong>{item.job_title}</strong>
                          <span>{[item.company, item.location].filter(Boolean).join(' • ')}</span>
                          {(item.start_date || item.end_date) && (
                            <small>{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</small>
                          )}
                          {item.description && <p>{item.description}</p>}
                        </div>
                      ))}
                  </section>
                )}

                {Array.isArray(resumePreview.education) && resumePreview.education.length > 0 && (
                  <section>
                    <h3>Education</h3>
                    {[...resumePreview.education]
                      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                      .map((item: any, index: number) => (
                        <div className="sidebar-preview-entry" key={item.id ?? index}>
                          <strong>{item.school}</strong>
                          <span>{[item.degree, item.field_of_study].filter(Boolean).join(' • ')}</span>
                          {(item.start_date || item.end_date) && (
                            <small>{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</small>
                          )}
                        </div>
                      ))}
                  </section>
                )}

                {Array.isArray(resumePreview.skills) && resumePreview.skills.length > 0 && (
                  <section>
                    <h3>Skills</h3>
                    <p>
                      {[...resumePreview.skills]
                        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                        .map((item: any) => item.skill_name)
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </section>
                )}

                {Array.isArray(resumePreview.projects) && resumePreview.projects.length > 0 && (
                  <section>
                    <h3>Projects</h3>
                    {[...resumePreview.projects]
                      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                      .map((item: any, index: number) => (
                        <div className="sidebar-preview-entry" key={item.id ?? index}>
                          <strong>{item.name}</strong>
                          {item.link && <small>{item.link}</small>}
                          {item.description && <p>{item.description}</p>}
                        </div>
                      ))}
                  </section>
                )}

                {Array.isArray(resumePreview.certifications) && resumePreview.certifications.length > 0 && (
                  <section>
                    <h3>Certifications</h3>
                    {[...resumePreview.certifications]
                      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                      .map((item: any, index: number) => (
                        <div className="sidebar-preview-entry" key={item.id ?? index}>
                          <strong>{item.name}</strong>
                          <span>{[item.issuer, item.date_earned].filter(Boolean).join(' • ')}</span>
                        </div>
                      ))}
                  </section>
                )}
              </article>
            </div>
          </div>
        ) : (
<>
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
                onClick={(event) => {
                  if (step.key === 'welcome') {
                    event.preventDefault()
                    event.stopPropagation()
                    onHomeClick()
                  }
                }}
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

</>
        )}
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
