import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (content: string) => void
  disabled: boolean
}

export function MessageInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  return (
    <div className="message-input-container">
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
