import { useState, useRef, useEffect } from 'react'

const SLASH_COMMANDS = [
  { name: '/plan', description: 'Ask the Coordinator to draft a plan first' },
  { name: '/agents', description: 'Create specialist agent tasks for this request' },
  { name: '/agent', description: 'Create one role task: /agent reviewer check changes' },
  { name: '/mcp', description: 'List MCP setup guidance' },
  { name: '/terminal', description: 'Ask for a command-oriented workflow' },
  { name: '/workdir', description: 'Inspect or change the active workspace' },
  { name: '/model', description: 'Discuss model configuration' },
  { name: '/help', description: 'Show available workbench commands' }
]

interface Props {
  onSend: (content: string) => void
  disabled: boolean
}

export function MessageInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSlashMode = input.startsWith('/')
  const slashMatches = isSlashMode
    ? SLASH_COMMANDS.filter((command) => command.name.startsWith(input.split(/\s/)[0]))
    : []

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus()
    }
  }, [disabled])

  const handleSend = () => {
    if (!input.trim() || disabled) return
    onSend(input)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestion((idx) => (idx + 1) % slashMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestion((idx) => (idx - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        setInput(`${slashMatches[activeSuggestion].name} `)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    setActiveSuggestion(0)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  return (
    <div className="message-input-container">
      {slashMatches.length > 0 && (
        <div className="slash-suggestions">
          {slashMatches.map((command, index) => (
            <button
              key={command.name}
              className={`slash-suggestion-item ${index === activeSuggestion ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                setInput(`${command.name} `)
                textareaRef.current?.focus()
              }}
            >
              <span className="slash-command-name">{command.name}</span>
              <span className="slash-command-description">{command.description}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="message-input"
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Waiting for response...' : 'Type your message... (Enter to send, Shift+Enter for new line)'}
        disabled={disabled}
        rows={1}
      />
      <button
        className="send-btn"
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        title="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
