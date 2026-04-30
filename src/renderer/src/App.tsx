import { useEffect, useState } from 'react'
import { useSettings } from './hooks/useSettings'
import { useConversationStore } from './store/conversation-store'
import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { MainPanel } from './components/layout/MainPanel'
import { WelcomeSetup } from './components/settings/WelcomeSetup'

export default function App() {
  const { settings, loaded } = useSettings()
  const loadConversations = useConversationStore((s) => s.loadConversations)
  const [showWelcome, setShowWelcome] = useState(false)
  const [setupDone, setSetupDone] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  // After settings are loaded, check if we need welcome flow
  useEffect(() => {
    if (loaded && !settings.apiKey && !setupDone) {
      setShowWelcome(true)
    }
  }, [loaded])

  if (!loaded) {
    return <div className="app-loading">Loading...</div>
  }

  if (showWelcome) {
    return (
      <div className="app">
        <TitleBar />
        <WelcomeSetup
          onComplete={() => {
            setShowWelcome(false)
            setSetupDone(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <MainPanel />
      </div>
    </div>
  )
}
