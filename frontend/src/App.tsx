import { useEffect, useState } from 'react'
import './App.css'

import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import TailorPage, {
  type ResumeSource,
  type TailorSubmission,
} from './pages/TailorPage'
import { ResumePage } from './pages/ResumePage'

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

function App() {
  const [resumeSession, setResumeSession] = useState(0)
  // Track the active page
  const [currentScreen, setCurrentScreen] =
    useState<ScreenName>(() =>
      getCurrentScreen() === 'tailor' ? 'welcome' : getCurrentScreen()
    )

  // Resume state shared between the Resume and Tailor pages
  const [createBlankResume, setCreateBlankResume] =
    useState(true)
  const [resumeReady, setResumeReady] = useState(false)

  // Profile initials displayed in the navigation
  const [profileInitials, setProfileInitials] =
    useState<string | null>(null)

  // Keep guest and registered user sessions separate
  const [accountType, setAccountType] =
    useState<'guest' | 'user' | null>(null)

  // Handle page navigation and prevent access to Tailor without a resume
  useEffect(() => {
    const onHashChange = () => {
      const nextScreen = getCurrentScreen()

      if (nextScreen === 'tailor' && !resumeReady) {
        window.location.hash = accountType ? '#parsed' : '#welcome'
        return
      }

      setCurrentScreen(nextScreen)
    }

    // A page refresh cannot restore the unsaved resume kept in React state.
    if (getCurrentScreen() === 'tailor' && !resumeReady) {
      window.location.hash = accountType ? '#parsed' : '#welcome'
    }

    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener(
        'hashchange',
        onHashChange
      )
    }
  }, [resumeReady, accountType])

  
  // Start a guest session and open the Resume page
  const handleContinueAsGuest = () => {
    setAccountType('guest')
    setResumeReady(false)
    setProfileInitials('G')
    setResumeSession(current => current + 1)

    // false loads the sample data from resumeData.ts
    setCreateBlankResume(false)

    window.location.hash = '#parsed'
  }

  // Set up the user profile after login
  const handleAccountLogin = (
    firstName: string,
    lastName: string
  ) => {
    const initials =
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

    setProfileInitials(initials)
    setAccountType('user')
    setResumeReady(false)
    setCreateBlankResume(true)

    window.location.hash = '#parsed'
  }

  // Reset the current workspace when returning Home
  const handleHomeClick = () => {
    setAccountType(null)
    setResumeReady(false)
    setProfileInitials(null)
    setCreateBlankResume(true)

    window.dispatchEvent(
      new Event('resetWelcomeForm')
    )

    window.location.hash = '#welcome'
  }

  // Open the Resume page when creating or editing a resume
  const handleOpenResume = (
    source: ResumeSource,
    _file: File | null
  ) => {
    setCreateBlankResume(
      source === 'scratch'
    )

    window.location.hash = '#parsed'
  }

  // Handle Tailor form submission
  const handleTailorSubmit = (
    submission: TailorSubmission
  ) => {
    setCreateBlankResume(
      submission.source === 'scratch'
    )

    // Stay on the Tailor page after submission.
    // Future AI analysis logic can be added here.
  }

  // Navigate back to Welcome without clearing the current profile
  const handleBackToWelcome = () => {
    window.location.hash = '#welcome'
  }

  // Render the selected page based on the current navigation state
  const renderCurrentPage = () => {
    switch (currentScreen) {
      case 'welcome':
        return (
          <WelcomePage
            onContinueAsGuest={
              handleContinueAsGuest
            }
            onLogin={handleAccountLogin}
          />
        )

      /*
       * PAGE 2
       * Build your resume
       */
      case 'parsed':
        return (
          <ResumePage
            key={resumeSession}
            blankResume={createBlankResume}
            isGuest={accountType !== 'user'}
            onResumeReadyChange={setResumeReady}
          />
        )

      /*
       * PAGE 3
       * Tailor Resume
       */
      case 'tailor':
        return (
          <TailorPage
            onOpenResume={handleOpenResume}
            onSubmit={handleTailorSubmit}
            onBack={handleBackToWelcome}
          />
        )

      default:
        return (
          <WelcomePage
            onContinueAsGuest={
              handleContinueAsGuest
            }
            onLogin={handleAccountLogin}
          />
        )
    }
  }

  // Keep the navigation layout consistent across all pages
  return (
    <Layout
      currentScreen={currentScreen}
      profileInitials={profileInitials}
      onHomeClick={handleHomeClick}
    >
      {renderCurrentPage()}
    </Layout>
  )
}

export default App