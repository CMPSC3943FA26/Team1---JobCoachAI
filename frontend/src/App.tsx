import { useEffect, useState } from 'react'
import './App.css'

import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import TailorPage, {
  type ResumeSource,
  type TailorSubmission,
} from './pages/TailorPage'
import { ResumePage } from './pages/ResumePage'

const screenNames = ['welcome', 'parsed', 'tailor'] as const

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
    }

    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener(
        'hashchange',
        onHashChange
      )
    }
  }, [])

  /*
   * Guest login
   *
   * New flow:
   * Welcome -> Build Resume
   */
  const handleContinueAsGuest = () => {
    setProfileInitials('G')
    setCreateBlankResume(false)

    window.location.hash = '#parsed'
  }

  /*
   * Account login
   *
   * New flow:
   * Welcome -> Build Resume
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
    setCreateBlankResume(false)

    window.location.hash = '#parsed'
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
   * Called from TailorPage when the user
   * chooses to create/edit their resume.
   *
   * Since Build Resume is now Page 2,
   * this takes the user back to Page 2.
   */
  const handleOpenResume = (
    source: ResumeSource,
    _file: File | null
  ) => {
    setCreateBlankResume(
      source === 'scratch'
    )

    window.location.hash = '#parsed'
  }

  /*
   * Submit Tailor form.
   *
   * Tailor is now Page 3, so submitting
   * should NOT send the user backward
   * to the Build Resume page.
   *
   * AI analysis/recommendation handling
   * can be added here when the backend
   * functionality is connected.
   */
  const handleTailorSubmit = (
    submission: TailorSubmission
  ) => {
    setCreateBlankResume(
      submission.source === 'scratch'
    )

    // Stay on the Tailor page after submission.
    // Future AI analysis logic can be added here.
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
            onContinueAsGuest={
              handleContinueAsGuest
            }
            onLogin={handleAccountLogin}
          />
        )

      /*
       * PAGE 2
       * Build Resume
       */
      case 'parsed':
        return (
          <ResumePage
            blankResume={createBlankResume}
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