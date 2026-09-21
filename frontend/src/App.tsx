import { useEffect, useState } from 'react'
import './App.css'

import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import TailorPage, {
  type ResumeSource,
  type TailorSubmission,
} from './pages/TailorPage'
import { ResumePage, resumeDraftStorageKey } from './pages/ResumePage'

// Available screens in the application
const screenNames = ['welcome', 'parsed', 'tailor'] as const

type ScreenName = (typeof screenNames)[number]

// Get the current page from the URL hash
function getCurrentScreen(): ScreenName {
  const hash = window.location.hash.replace('#', '')

  return screenNames.includes(hash as ScreenName)
    ? (hash as ScreenName)
    : 'welcome'
}

const leaveWorkspaceMessage =
  'Going to Welcome clears the current resume and starts a new workspace. Continue?'

function App() {
  const [resumeSession, setResumeSession] = useState(0)
  const [currentScreen, setCurrentScreen] =
    useState<ScreenName>(() =>
      getCurrentScreen() === 'tailor' ? 'welcome' : getCurrentScreen()
    )

  const [resumeReady, setResumeReady] = useState(false)
  const [profileInitials, setProfileInitials] = useState<string | null>(null)
  const [accountType, setAccountType] =
    useState<'guest' | 'user' | null>(null)
  const [showHomeWarning, setShowHomeWarning] = useState(false)

  // Handle page navigation and prevent access to Tailor without a resume
  useEffect(() => {
    const onHashChange = () => {
      const nextScreen = getCurrentScreen()

      if (nextScreen === 'tailor' && !resumeReady) {
        window.location.hash = accountType ? '#parsed' : '#welcome'
        return
      }

      if (nextScreen === 'welcome') {
        // Any route to Welcome ends the current draft, including browser Back
        // and the Welcome link in the sidebar. Page 2 <-> page 3 does not.
        sessionStorage.removeItem(resumeDraftStorageKey)
        setResumeReady(false)
        setProfileInitials(null)
        setAccountType(null)
        setResumeSession(current => current + 1)
        window.dispatchEvent(new Event('resetWelcomeForm'))
      }

      setCurrentScreen(nextScreen)
    }

    if (getCurrentScreen() === 'tailor' && !resumeReady) {
      window.location.hash = accountType ? '#parsed' : '#welcome'
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [resumeReady, accountType])

  // Start a guest session and open the Resume page
  const handleContinueAsGuest = () => {
    sessionStorage.removeItem(resumeDraftStorageKey)
    setAccountType('guest')
    setResumeReady(false)
    setProfileInitials('G')
    setResumeSession(current => current + 1)
    window.location.hash = '#parsed'
  }

  // Set up the user profile after login
  const handleAccountLogin = (firstName: string, lastName: string) => {
    const initials =
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

    setProfileInitials(initials)
    setAccountType('user')
    setResumeReady(false)
    setResumeSession(current => current + 1)
    window.location.hash = '#parsed'
  }

  // Complete the requested Home navigation after the user confirms.
  const goHome = () => {
    setShowHomeWarning(false)
    sessionStorage.removeItem(resumeDraftStorageKey)
    setResumeSession(current => current + 1)
    setAccountType(null)
    setResumeReady(false)
    setProfileInitials(null)

    window.dispatchEvent(new Event('resetWelcomeForm'))
    window.location.hash = '#welcome'
    setCurrentScreen('welcome')
  }

  // Layout calls this when the top-left JobCoachAI logo is clicked.
  const handleHomeClick = () => {
    const onResumeOrTailor =
      currentScreen === 'parsed' || currentScreen === 'tailor'
    const hasResumeDraft = Boolean(
      sessionStorage.getItem(resumeDraftStorageKey)
    )

    if (onResumeOrTailor && (resumeReady || hasResumeDraft)) {
      setShowHomeWarning(true)
      return
    }

    goHome()
  }

  // Open the Resume page when creating or editing a resume
  const handleOpenResume = (
    _source: ResumeSource,
    _file: File | null
  ) => {
    window.location.hash = '#parsed'
  }

  // Handle Tailor form submission
  const handleTailorSubmit = (_submission: TailorSubmission) => {
    // Stay on the Tailor page after submission.
  }

  const renderCurrentPage = () => {
    switch (currentScreen) {
      case 'welcome':
        return (
          <WelcomePage
            onContinueAsGuest={handleContinueAsGuest}
            onLogin={handleAccountLogin}
          />
        )

      case 'parsed':
        return (
          <ResumePage
            key={resumeSession}
            isGuest={accountType !== 'user'}
            onResumeReadyChange={setResumeReady}
          />
        )

      case 'tailor':
        return (
          <TailorPage
            onOpenResume={handleOpenResume}
            onSubmit={handleTailorSubmit}
            onBack={handleHomeClick}
            isGuest={accountType !== 'user'}
          />
        )

      default:
        return (
          <WelcomePage
            onContinueAsGuest={handleContinueAsGuest}
            onLogin={handleAccountLogin}
          />
        )
    }
  }

  return (
    <Layout
      currentScreen={currentScreen}
      profileInitials={profileInitials}
      onHomeClick={handleHomeClick}
    >
      {renderCurrentPage()}

      {showHomeWarning && (
        <div
          className="dialog-backdrop"
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background: 'rgba(23, 32, 51, 0.55)',
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="home-warning-title"
            aria-describedby="home-warning-description"
            style={{
              width: 'min(460px, 100%)',
              padding: 28,
              background: '#fff',
              color: '#172033',
              boxShadow: '0 24px 60px rgba(23, 32, 51, 0.24)',
            }}
          >
            <span className="panel-icon">LEAVE WORKSPACE</span>
            <h3 id="home-warning-title">Leave this page?</h3>
            <p id="home-warning-description">{leaveWorkspaceMessage}</p>

            <div
              className="dialog-actions"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 24,
              }}
            >
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowHomeWarning(false)}
              >
                Stay on page
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={goHome}
              >
                Go to Home →
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default App
