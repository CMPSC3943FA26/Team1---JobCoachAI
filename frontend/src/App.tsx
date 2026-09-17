import { useEffect, useState } from 'react'
import './App.css'

import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import TailorPage, {
  type ResumeSource,
  type TailorSubmission,
} from './pages/TailorPage'
import { ResumePage } from './pages/ResumePage'

const screenNames = ['welcome', 'tailor', 'parsed'] as const

type ScreenName = (typeof screenNames)[number]

function getCurrentScreen(): ScreenName {
  const hash = window.location.hash.replace('#', '')

  return screenNames.includes(hash as ScreenName)
    ? (hash as ScreenName)
    : 'welcome'
}

function App() {
  const [currentScreen, setCurrentScreen] =
    useState<ScreenName>(getCurrentScreen)

  const [createBlankResume, setCreateBlankResume] =
    useState(false)

  /*
   * Profile icon initials:
   * G  = Guest
   * SB = Example logged-in user initials
   * null = No active profile
   */
  const [profileInitials, setProfileInitials] =
    useState<string | null>(null)

  useEffect(() => {
    const onHashChange = () => {
      const nextScreen = getCurrentScreen()

      setCurrentScreen(nextScreen)

      if (nextScreen === 'tailor') {
        setCreateBlankResume(false)
      }
    }

    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  /*
   * Guest login
   */
  const handleContinueAsGuest = () => {
    setProfileInitials('G')
    window.location.hash = '#tailor'
  }

  /*
   * Later, when account login is connected,
   * call this with the user's first and last name.
   *
   * Example:
   * handleAccountLogin('Suprit', 'Bijukshe')
   * Profile icon becomes "SB"
   */
  
  const handleAccountLogin = (
    firstName: string,
    lastName: string
  ) => {
    const initials =
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

    setProfileInitials(initials)

    window.location.hash = '#tailor'
  }

  /*
   * Clicking JobCoach AI Home clears
   * the current guest/account profile.
   */
  const handleHomeClick = () => {
    setProfileInitials(null)
    setCreateBlankResume(false)

    window.dispatchEvent(
      new Event('resetWelcomeForm')
    )

    window.location.hash = '#welcome'
  }

  /*
   * Create / Edit Resume
   */
  const handleOpenResume = (
    source: ResumeSource,
    _file: File | null
  ) => {
    setCreateBlankResume(source === 'scratch')
    window.location.hash = '#parsed'
  }

  /*
   * Submit Tailor form
   */
  const handleTailorSubmit = (
    submission: TailorSubmission
  ) => {
    setCreateBlankResume(
      submission.source === 'scratch'
    )

    window.location.hash = '#parsed'
  }

  /*
   * Return to Welcome.
   * This does NOT clear the current profile.
   */
  const handleBackToWelcome = () => {
    window.location.hash = '#welcome'
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

      case 'tailor':
        return (
          <TailorPage
            onOpenResume={handleOpenResume}
            onSubmit={handleTailorSubmit}
            onBack={handleBackToWelcome}
          />
        )

      case 'parsed':
        return (
          <ResumePage
            blankResume={createBlankResume}
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
    </Layout>
  )
}

export default App