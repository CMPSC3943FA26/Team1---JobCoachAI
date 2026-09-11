import { useEffect, useState } from 'react'
import './App.css'

import { Layout } from './components/Layout'
import { WelcomePage } from './pages/WelcomePage'
import { TailorPage } from './pages/TailorPage'
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

  /*
   * Determines whether Page 3 should open as
   * a completely blank resume.
   */
  const [createBlankResume, setCreateBlankResume] =
    useState(false)

  useEffect(() => {
    const onHashChange = () => {
      setCurrentScreen(getCurrentScreen())
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
   * Create Resume button:
   *
   * 1. Tell ResumePage to use empty fields.
   * 2. Navigate to Page 3.
   */
  const handleCreateResume = () => {
    setCreateBlankResume(true)
    window.location.hash = '#parsed'
  }

  const renderCurrentPage = () => {
    switch (currentScreen) {

      case 'welcome':
        return <WelcomePage />

      case 'tailor':
        return (
          <TailorPage
            onCreateResume={handleCreateResume}
          />
        )

      case 'parsed':
        return (
          <ResumePage
            blankResume={createBlankResume}
          />
        )

      default:
        return <WelcomePage />
    }
  }

  return (
    <Layout currentScreen={currentScreen}>
      {renderCurrentPage()}
    </Layout>
  )
}

export default App