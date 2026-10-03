import { useEffect, useRef, useState } from 'react'
import './App.css'

import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import TailorPage, {
  type ResumeSource,
  type TailorSubmission,
} from './pages/TailorPage'
import { ResumePage, resumeDraftStorageKey, resumeIdStorageKey } from './pages/ResumePage'
import { ProfilePage } from './pages/ProfilePage'
import { signOutUser } from './lib/supabase'

// Available screens in the application
const screenNames = ['welcome', 'parsed', 'tailor', 'profile'] as const

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
  const [accountName, setAccountName] = useState<string | null>(null)
  const [profileSection, setProfileSection] = useState<'profile' | 'resumes'>('profile')
  const [accountType, setAccountType] =
    useState<'guest' | 'user' | null>(null)
  const [showHomeWarning, setShowHomeWarning] = useState(false)
  const [sidebarResumePreview, setSidebarResumePreview] = useState<Record<string, any> | null>(null)
  const bypassWelcomeWarningRef = useRef(false)

  // Handle page navigation and prevent access to Tailor without a resume
  useEffect(() => {
    const onHashChange = () => {
      const nextScreen = getCurrentScreen()

      if (nextScreen === 'tailor' && !resumeReady) {
        window.location.hash = accountType ? '#parsed' : '#welcome'
        return
      }

      if (nextScreen === 'welcome') {
        const leavingResumeWorkspace =
          currentScreen === 'parsed' || currentScreen === 'tailor'

        if (
          accountType !== null &&
          leavingResumeWorkspace &&
          !bypassWelcomeWarningRef.current
        ) {
          setShowHomeWarning(true)
          window.location.hash = `#${currentScreen}`
          return
        }

        bypassWelcomeWarningRef.current = false
        sessionStorage.removeItem(resumeDraftStorageKey)
        setResumeReady(false)
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
  }, [resumeReady, accountType, currentScreen])

  // Start a guest session and open the Resume page
  const handleContinueAsGuest = () => {
    sessionStorage.removeItem(resumeDraftStorageKey)
    sessionStorage.removeItem(resumeIdStorageKey)
    setSidebarResumePreview(null)
    setAccountType('guest')
    setResumeReady(false)
    setProfileInitials('G')
    setAccountName(null)
    setResumeSession(current => current + 1)
    window.location.hash = '#parsed'
  }

  // Set up the user profile after login
  const handleAccountLogin = (firstName: string, lastName: string) => {
    sessionStorage.removeItem(resumeIdStorageKey)
    const firstInitial = firstName.trim().charAt(0)
    const lastInitial = lastName.trim().charAt(0)
    const initials = `${firstInitial}${lastInitial}`.toUpperCase() || 'U'

    setSidebarResumePreview(null)
    setProfileInitials(initials)
    setAccountName(`${firstName.trim()} ${lastName.trim()}`.trim() || 'User')
    setAccountType('user')
    setResumeReady(false)
    setResumeSession(current => current + 1)
    window.location.hash = '#parsed'
  }

  // Complete the requested Home navigation after the user confirms.
  const goHome = () => {
    setShowHomeWarning(false)
    bypassWelcomeWarningRef.current = true
    sessionStorage.removeItem(resumeDraftStorageKey)
    sessionStorage.removeItem(resumeIdStorageKey)
    setResumeSession(current => current + 1)
    setResumeReady(false)
    setSidebarResumePreview(null)

    window.dispatchEvent(new Event('resetWelcomeForm'))
    window.location.hash = '#welcome'
    setCurrentScreen('welcome')
  }

  // Route every explicit Welcome/Home navigation through the same guard.
  // This covers both page 2 (parsed) and page 3 (tailor), including the
  // JobCoachAI logo and the Welcome item in the left workflow panel.
  const handleHomeClick = () => {
    const activeScreen = getCurrentScreen()
    const onResumeOrTailor =
      activeScreen === 'parsed' || activeScreen === 'tailor' ||
      currentScreen === 'parsed' || currentScreen === 'tailor'

    if (accountType !== null && onResumeOrTailor) {
      setShowHomeWarning(true)
      return
    }

    goHome()
  }


  const handleOpenProfile = (section: 'profile' | 'resumes' = 'profile') => {
    if (accountType !== 'user') return
    setProfileSection(section)
    window.location.hash = '#profile'
  }

  const handleProfileNameChange = (firstName: string, lastName: string) => {
    const firstInitial = firstName.trim().charAt(0)
    const lastInitial = lastName.trim().charAt(0)
    setProfileInitials(`${firstInitial}${lastInitial}`.toUpperCase() || 'U')
    setAccountName(`${firstName.trim()} ${lastName.trim()}`.trim() || 'User')
  }

  const handleLogout = async () => {
    try {
      await signOutUser()
    } catch (error) {
      console.error('Logout error:', error)
    }

    sessionStorage.removeItem(resumeDraftStorageKey)
    sessionStorage.removeItem(resumeIdStorageKey)
    setSidebarResumePreview(null)
    setAccountType(null)
    setProfileInitials(null)
    setAccountName(null)
    setResumeReady(false)
    setResumeSession(current => current + 1)
    window.dispatchEvent(new Event('resetWelcomeForm'))
    window.location.hash = '#welcome'
    setCurrentScreen('welcome')
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


      case 'profile':
        if (accountType !== 'user') {
          return (
            <WelcomePage
              onContinueAsGuest={handleContinueAsGuest}
              onLogin={handleAccountLogin}
            />
          )
        }

        return (
          <ProfilePage
            focusSection={profileSection}
            onNameChange={handleProfileNameChange}
            onResumeOpened={() => {
              setSidebarResumePreview(null)
              setResumeReady(true)
              setResumeSession(current => current + 1)
            }}
            onResumePreviewed={setSidebarResumePreview}
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
      isGuest={accountType === 'guest'}
      accountName={accountName}
      onHomeClick={handleHomeClick}
      onOpenProfile={() => handleOpenProfile('profile')}
      onOpenSavedResumes={() => handleOpenProfile('resumes')}
      onLogout={() => void handleLogout()}
      resumePreview={sidebarResumePreview}
      onCloseResumePreview={() => setSidebarResumePreview(null)}
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
