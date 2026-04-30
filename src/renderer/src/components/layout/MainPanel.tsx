import { useConversationStore } from '../../store/conversation-store'
import { ChatView } from '../chat/ChatView'

export function MainPanel() {
  const activeId = useConversationStore((s) => s.activeConversationId)
  const createConversation = useConversationStore((s) => s.createConversation)

  if (!activeId) {
    return (
      <div className="main-panel main-panel-empty">
        <div className="empty-state">
          <h2>Lunar Agent Workbench</h2>
          <p>Your local AI coding workbench</p>
          <button className="empty-start-btn" onClick={() => createConversation()}>
            Start a conversation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="main-panel">
      <ChatView />
    </div>
  )
}
