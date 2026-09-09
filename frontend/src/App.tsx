// App.tsx
// Root application component.
// This keeps the design flow in one place while separating screens and shared UI pieces.

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
  return screenNames.includes(hash as ScreenName) ? (hash as ScreenName) : 'welcome'
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(getCurrentScreen)

  useEffect(() => {
    const onHashChange = () => setCurrentScreen(getCurrentScreen())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const renderCurrentPage = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomePage />
      case 'tailor':
        return <TailorPage />
      case 'parsed':
        return <ResumePage />
      default:
        return <WelcomePage />
    }
  }

  return <Layout currentScreen={currentScreen}>{renderCurrentPage()}</Layout>
}

export default App
