import { Plus, MessageSquare, Trash2, Settings, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useConversationStore } from '../../store/conversation-store'
import { useSettingsStore } from '../../store/settings-store'
import { SettingsDialog } from '../settings/SettingsDialog'

export function Sidebar() {
  const [showSettings, setShowSettings] = useState(false)
  const conversations = useConversationStore((s) => s.conversations)
  const activeId = useConversationStore((s) => s.activeConversationId)
  const createConversation = useConversationStore((s) => s.createConversation)
  const setActive = useConversationStore((s) => s.setActiveConversation)
  const deleteConv = useConversationStore((s) => s.deleteConversation)
  const settings = useSettingsStore((s) => s.settings)
  const hasApiKey = !!settings.apiKey

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="sidebar-new-btn" onClick={() => createConversation()} disabled={!hasApiKey}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="sidebar-conversations">
        {!hasApiKey ? (
          <div className="sidebar-empty">
            <p>No API Key configured</p>
            <button className="sidebar-setup-btn" onClick={() => setShowSettings(true)}>
              Open Settings
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="sidebar-empty">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`sidebar-item ${conv.id === activeId ? 'active' : ''}`}
              onClick={() => setActive(conv.id)}
            >
              <MessageSquare size={14} />
              <span className="sidebar-item-title">{conv.title}</span>
              <button
                className="sidebar-item-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteConv(conv.id)
                }}
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-model-badge">{settings.model}</div>
        {settings.workDirectory && (
          <div
            className="sidebar-workdir"
            title={settings.workDirectory}
            onClick={() => window.api.openInExplorer(settings.workDirectory)}
          >
            <FolderOpen size={14} />
            <span>{settings.workDirectory.split(/[\\/]/).pop()}</span>
          </div>
        )}
        <button className="sidebar-settings-btn" onClick={() => setShowSettings(true)}>
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
