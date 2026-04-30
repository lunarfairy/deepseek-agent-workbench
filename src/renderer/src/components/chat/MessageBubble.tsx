import { useState } from 'react'
import type { ChatMessage } from '../../../../shared/types'
import { CodeBlock } from './CodeBlock'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const [showReasoning, setShowReasoning] = useState(false)

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">{isUser ? 'U' : 'AI'}</div>
      <div className="message-content">
        {!isUser && message.reasoningContent && (
          <div className="reasoning-section">
            <button
              className="reasoning-toggle"
              onClick={() => setShowReasoning(!showReasoning)}
            >
              {showReasoning ? '▼' : '▶'} Thinking...
            </button>
            {showReasoning && (
              <div className="reasoning-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.reasoningContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeStr = String(children).replace(/\n$/, '')
                  if (match) {
                    return <CodeBlock language={match[1]} code={codeStr} />
                  }
                  return (
                    <code className="inline-code" {...props}>
                      {children}
                    </code>
                  )
                },
                pre({ children }) {
                  return <>{children}</>
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="tool-results">
            {message.toolResults.map((tr, i) => (
              <div key={i} className={`tool-result ${tr.approved ? 'approved' : 'rejected'}`}>
                <div className="tool-result-header">
                  <span>{tr.approved ? '✓ Executed' : '✗ Rejected'}</span>
                </div>
                <pre className="tool-result-content">{tr.content}</pre>
              </div>
            ))}
          </div>
        )}
        {message.isStreaming && <span className="streaming-cursor">▌</span>}
      </div>
    </div>
  )
}
