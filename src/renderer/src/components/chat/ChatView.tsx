import { useEffect, useRef } from 'react'
import { useConversationStore } from '../../store/conversation-store'
import { useChat } from '../../hooks/useChat'
import { useToolApproval } from '../../hooks/useToolApproval'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { ToolCallCard } from '../tools/ToolCallCard'

export function ChatView() {
  const conversation = useConversationStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeConversationId)
    return conv
  })
  const isStreaming = useConversationStore((s) => s.isStreaming)
  const { sendMessage } = useChat()
  const { pendingRequests, approve, reject } = useToolApproval()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages, pendingRequests])

  if (!conversation) return null

  return (
    <div className="chat-view">
      <div className="message-list">
        {conversation.messages.length === 0 && (
          <div className="chat-empty">
            <p>Send a message to start coding with DeepSeek.</p>
          </div>
        )}
        {conversation.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {pendingRequests.map((req) => (
          <ToolCallCard
            key={req.toolCallId}
            request={req}
            onApprove={() => approve(req.toolCallId)}
            onReject={() => reject(req.toolCallId)}
          />
        ))}
        {isStreaming && (
          <div className="streaming-indicator">
            <div className="streaming-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  )
}
