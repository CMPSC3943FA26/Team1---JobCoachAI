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
import { signOutUser, supabase } from './lib/supabase'
import { saveWorkspace, restoreWorkspace } from './services/workspaceStorage'

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

const tailoredPayloadStorageKey = 'jobcoachai.tailoredResumePayload'

const leaveWorkspaceMessage =
  'Going to Welcome clears the current resume and starts a new workspace. Continue?'

function App() {
  const [resumeSession, setResumeSession] = useState(0)
  const [currentScreen, setCurrentScreen] =
    useState<ScreenName>(() =>
      getCurrentScreen() === 'tailor' ? 'welcome' : getCurrentScreen()
    )

  const [resumeReady, setResumeReady] = useState(false)
  const [page2NeedsContinue, setPage2NeedsContinue] = useState(false)
  const [page2RequiredFieldsComplete, setPage2RequiredFieldsComplete] = useState(false)
  const [showContinueWarning, setShowContinueWarning] = useState(false)
  const allowSavedContinueRef = useRef(false)
  const continueWarningMessage = 'You have unsaved resume changes. To save your draft and proceed to Page 3, click Continue on the Resume Editor.'
  const handleContinueToTailor = () => {
    allowSavedContinueRef.current = true
    setPage2NeedsContinue(false)
    window.location.hash = '#tailor'
  }
  const [profileInitials, setProfileInitials] = useState<string | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [profileSection, setProfileSection] = useState<'profile' | 'resumes'>('profile')
  const [accountType, setAccountType] = useState<'guest' | 'user' | null>(null)
  const accountTypeRef = useRef<'guest' | 'user' | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [logoutPending, setLogoutPending] = useState(false)
  const [showHomeWarning, setShowHomeWarning] = useState(false)
  // Keep Page 3 mounted after the first visit to preserve in-memory AI edits.
  const [tailorMounted, setTailorMounted] = useState(false)
  const [sidebarResumePreview, setSidebarResumePreview] = useState<Record<string, any> | null>(null)
  const bypassWelcomeWarningRef = useRef(false)
 
  // Handle page navigation and prevent access to Tailor without a resume
  useEffect(() => {
    const onHashChange = () => {
      const nextScreen = getCurrentScreen()

      // Users must log in or explicitly continue as guest
      // before accessing Page 2, Page 3, or Profile.
      if (accountTypeRef.current === null && nextScreen !== 'welcome') {
        window.location.hash = '#welcome'
        setCurrentScreen('welcome')
        return
      }

      // Saved Resumes is an edit/review entry point, not a shortcut to tailoring.
      // Ignore direct hash navigation to Page 3 from this view as well.
      if (nextScreen === 'tailor' && currentScreen === 'profile' && profileSection === 'resumes') {
        window.location.hash = '#profile'
        return
      }

      // Prevent bypassing Page 2's Save + Continue workflow by clicking the
      // sidebar, typing #tailor, or using browser forward navigation.
      if (nextScreen === 'tailor' && currentScreen === 'parsed' && !allowSavedContinueRef.current) {
        // A blank or incomplete editor must not open Page 3 or show a warning.
        if (!page2RequiredFieldsComplete) {
          window.location.hash = '#parsed'
          return
        }
        // A completed but modified resume must be saved through Continue.
        if (page2NeedsContinue) {
          setShowContinueWarning(true)
          window.location.hash = '#parsed'
          return
        }
      }
      if (nextScreen === 'tailor') allowSavedContinueRef.current = false

      // Page 3 also requires a resume.
      if (nextScreen === 'tailor' && !resumeReady) {
        window.location.hash = '#parsed'
        return
      }
      if (nextScreen === 'tailor') setTailorMounted(true)

      if (nextScreen === 'welcome') {
        const leavingResumeWorkspace =
          currentScreen === 'parsed' || currentScreen === 'tailor' ||
          (currentScreen === 'profile' && profileSection === 'resumes')

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
        // Do not erase resume data merely because the user visits Welcome.
        setResumeReady(false)
    setPage2RequiredFieldsComplete(false)
        setResumeSession(current => current + 1)
        window.dispatchEvent(new Event('resetWelcomeForm'))
      }

      setCurrentScreen(nextScreen)
    }

    const initialScreen = getCurrentScreen()

    if (accountTypeRef.current === null && initialScreen !== 'welcome') {
      window.location.hash = '#welcome'
      setCurrentScreen('welcome')
    } else if (initialScreen === 'tailor' && !resumeReady) {
      window.location.hash = '#parsed'
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [resumeReady, accountType, currentScreen, profileSection, page2NeedsContinue, page2RequiredFieldsComplete])


  // Navigate only after the account state and navigation guard have updated.
  useEffect(() => {
    if (accountType !== null) {
      window.location.hash = '#parsed'
    }
  }, [accountType])

  // Restore only the currently authenticated account's workspace.
  const restoreForCurrentAccount = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      console.warn('Workspace restoration skipped: no authenticated user.', error)
      return
    }
    restoreWorkspace(user.id)
  }

  // Start a guest session and open the Resume page.
  const handleContinueAsGuest = async () => {
    try {
      await restoreForCurrentAccount()
    } catch (error) {
      console.error('Unable to restore guest workspace:', error)
    }
    
    setSidebarResumePreview(null)
    setTailorMounted(false)
    accountTypeRef.current = 'guest'
    setAccountType('guest')
    setResumeReady(false)
    setPage2RequiredFieldsComplete(false)
    setProfileInitials('G')
    setAccountName(null)
    setResumeSession(current => current + 1)
  }

  // Set up the user profile after login and restore the user's own draft.
  const handleAccountLogin = async (firstName: string, lastName: string) => {
    try {
      await restoreForCurrentAccount()
    } catch (error) {
      console.error('Unable to restore user workspace:', error)
    }
    const firstInitial = firstName.trim().charAt(0)
    const lastInitial = lastName.trim().charAt(0)
    const initials = `${firstInitial}${lastInitial}`.toUpperCase() || 'U'

    setSidebarResumePreview(null)
    setTailorMounted(false)
    setProfileInitials(initials)
    setAccountName(`${firstName.trim()} ${lastName.trim()}`.trim() || 'User')
    accountTypeRef.current = 'user'
    setAccountType('user')
    setResumeReady(false)
    setPage2RequiredFieldsComplete(false)
    setResumeSession(current => current + 1)
  }

  // Complete the requested Home navigation after the user confirms.
  const goHome = async () => {
    // A signed-in user must log out only after confirming Leave Workspace.
    // handleLogout saves the draft before signing out and performs cleanup
    // only if sign-out succeeds.
    if (accountType === 'user') {
      await handleLogout()
      return
    }

    setShowHomeWarning(false)
    bypassWelcomeWarningRef.current = true
    sessionStorage.removeItem(resumeDraftStorageKey)
    sessionStorage.removeItem(resumeIdStorageKey)
    setResumeSession(current => current + 1)
    setResumeReady(false)
    setPage2RequiredFieldsComplete(false)
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
      currentScreen === 'parsed' || currentScreen === 'tailor' ||
      (currentScreen === 'profile' && profileSection === 'resumes')

    if (accountType !== null && onResumeOrTailor) {
      setShowHomeWarning(true)
      return
    }

    goHome()
  }


  // Page 2 and Page 3 navigation never clears either workspace.
  const handleBuildResumeClick = () => {
    window.location.hash = '#parsed'
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
    setLogoutPending(true)
    setLogoutError('')

    try {
      // Save before signing out and before any cleanup/remount occurs.
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw userError ?? new Error('Unable to identify the current user to save the draft.')
      }
      saveWorkspace(user.id)
      await signOutUser()

      // Bypass the normal Leave Workspace warning during logout
      bypassWelcomeWarningRef.current = true
      setShowHomeWarning(false)

      sessionStorage.removeItem(resumeDraftStorageKey)
      sessionStorage.removeItem(resumeIdStorageKey)
      sessionStorage.removeItem('jobcoachai.page3Draft')
      sessionStorage.removeItem(tailoredPayloadStorageKey)
      accountTypeRef.current = null

      setSidebarResumePreview(null)
      setTailorMounted(false)
      setAccountType(null)
      setProfileInitials(null)
      setAccountName(null)
      setResumeReady(false)
    setPage2RequiredFieldsComplete(false)
      setResumeSession((current) => current + 1)

      window.dispatchEvent(new Event('resetWelcomeForm'))

      setShowLogoutConfirm(false)

      // Go directly back to Welcome
      setCurrentScreen('welcome')
      window.location.hash = '#welcome'
    } catch (error) {
      console.error('Logout error:', error)

      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Unable to log out. Please try again.',
      )
    } finally {
      setLogoutPending(false)
    }
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
        if (accountType === null) {
          return (
            <WelcomePage
              onContinueAsGuest={handleContinueAsGuest}
              onLogin={handleAccountLogin}
            />
          )
        }

        return (
          <ResumePage
            key={resumeSession}
            isGuest={accountType !== 'user'}
            onResumeReadyChange={setResumeReady}
            onNeedsContinueChange={setPage2NeedsContinue}
              onRequiredFieldsCompleteChange={setPage2RequiredFieldsComplete}
            onContinueToTailor={handleContinueToTailor}
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
          if (accountType === null || !resumeReady) {
            return (
              <WelcomePage
                onContinueAsGuest={handleContinueAsGuest}
                onLogin={handleAccountLogin}
              />
            )
          }

          return (
            <TailorPage
              onOpenResume={handleOpenResume}
              onSubmit={handleTailorSubmit}
              onBack={handleHomeClick}
              isGuest={accountType !== 'user'}
              onResumePreviewed={setSidebarResumePreview}
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
      hasEnteredWorkspace={accountType !== null}
      accountName={accountName}
      onHomeClick={handleHomeClick}
      onBuildResumeClick={handleBuildResumeClick}
      onTailorNavigationClick={() => {
        if (currentScreen === 'parsed') {
          // Ignore Page 3 clicks until the mandatory Page 2 fields are filled.
          if (!page2RequiredFieldsComplete) return false
          if (page2NeedsContinue) {
            setShowContinueWarning(true)
            return false
          }
        }
        return true
      }}
      onOpenProfile={() => handleOpenProfile('profile')}
      onOpenSavedResumes={() => handleOpenProfile('resumes')}
      onLogout={() => {
        setLogoutError('')
        setShowLogoutConfirm(true)
      }}
      resumePreview={sidebarResumePreview}
      onCloseResumePreview={() => setSidebarResumePreview(null)}
    >
      {accountType !== null ? (
        <>
          {/* Keep Page 2 mounted so form edits survive navigation. */}
          <div style={{ display: currentScreen === 'parsed' ? 'contents' : 'none' }}>
            <ResumePage
              key={resumeSession}
              isGuest={accountType !== 'user'}
              onResumeReadyChange={setResumeReady}
              onNeedsContinueChange={setPage2NeedsContinue}
              onRequiredFieldsCompleteChange={setPage2RequiredFieldsComplete}
              onContinueToTailor={handleContinueToTailor}
            />
          </div>
          {/* Page 3 stays mounted after first visit, retaining AI results and keyword edits. */}
          {tailorMounted && (
            <div style={{ display: currentScreen === 'tailor' ? 'contents' : 'none' }}>
              <TailorPage
                onOpenResume={handleOpenResume}
                onSubmit={handleTailorSubmit}
                onBack={handleHomeClick}
                isGuest={accountType !== 'user'}
                onResumePreviewed={setSidebarResumePreview}
              />
            </div>
          )}
          {currentScreen !== 'parsed' && currentScreen !== 'tailor' && renderCurrentPage()}
        </>
      ) : renderCurrentPage()}

      {showContinueWarning && (
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
            aria-labelledby="continue-warning-title"
            aria-describedby="continue-warning-description"
            style={{
              width: 'min(460px, 100%)',
              padding: 28,
              background: '#fff',
              color: '#172033',
              boxShadow: '0 24px 60px rgba(23, 32, 51, 0.24)',
            }}
          >
            <span className="panel-icon">SAVE RESUME FIRST</span>
            <h3 id="continue-warning-title">Save before continuing</h3>
            <p id="continue-warning-description">{continueWarningMessage}</p>
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
                type="button"
                className="button button-primary"
                onClick={() => setShowContinueWarning(false)}
              >
                Return to Resume Editor
              </button>
            </div>
          </div>
        </div>
      )}

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
            {logoutError && (
              <p role="alert" style={{ color: '#b42318', marginTop: 12 }}>
                {logoutError}
              </p>
            )}

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
                disabled={logoutPending}
                onClick={() => { setShowHomeWarning(false); setLogoutError('') }}
              >
                Stay on page
              </button>

              <button
                className="button button-primary"
                type="button"
                onClick={() => { void goHome() }}
                disabled={logoutPending}
              >
                {logoutPending ? 'Logging out…' : 'Go to Home →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
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
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
            style={{
              width: 'min(460px, 100%)',
              padding: 28,
              background: '#fff',
              color: '#172033',
              boxShadow: '0 24px 60px rgba(23, 32, 51, 0.24)',
            }}
          >
            <span className="panel-icon">LOG OUT</span>
            <p id="logout-confirm-description">
              Are you sure you want to log out?
            </p>

            {logoutError && (
              <p
                role="alert"
                style={{
                  marginTop: 16,
                  color: '#b91c1c',
                }}
              >
                {logoutError}
              </p>
            )}

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
                disabled={logoutPending}
                onClick={() => {
                  setLogoutError('')
                  setShowLogoutConfirm(false)
                }}
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                type="button"
                disabled={logoutPending}
                onClick={() => void handleLogout()}
              >
                {logoutPending ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
  }

  export default App