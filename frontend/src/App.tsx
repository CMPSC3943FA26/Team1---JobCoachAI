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

  const [isGuest, setIsGuest] =
    useState(false)

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

  const handleContinueAsGuest = () => {
    setIsGuest(true)
    window.location.hash = '#tailor'
  }

  const handleHomeClick = () => {
    setIsGuest(false)
    setCreateBlankResume(false)

    window.dispatchEvent(
      new Event('resetWelcomeForm')
    )

    window.location.hash = '#welcome'
  }

  const handleOpenResume = (
    source: ResumeSource,
    _file: File | null
  ) => {
    setCreateBlankResume(source === 'scratch')
    window.location.hash = '#parsed'
  }

  const handleTailorSubmit = (
    submission: TailorSubmission
  ) => {
    setCreateBlankResume(
      submission.source === 'scratch'
    )

    window.location.hash = '#parsed'
  }

  const handleBackToWelcome = () => {
    window.location.hash = '#welcome'
  }

  const renderCurrentPage = () => {
    switch (currentScreen) {
      case 'welcome':
        return (
          <WelcomePage
            onContinueAsGuest={handleContinueAsGuest}
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
          />
        )
    }
  }

  return (
    <Layout
      currentScreen={currentScreen}
      isGuest={isGuest}
      onHomeClick={handleHomeClick}
    >
      {renderCurrentPage()}
    </Layout>
  )
}

export default App