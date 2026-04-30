import { CheckSquare, ClipboardList, Network, ShieldCheck, Users } from 'lucide-react'
import type { ToolApprovalRequest } from '../../../../shared/types'
import { useConversationStore } from '../../store/conversation-store'
import { ToolCallCard } from '../tools/ToolCallCard'

interface Props {
  pendingRequests: ToolApprovalRequest[]
  onApprove: (toolCallId: string) => void
  onReject: (toolCallId: string) => void
}

export function WorkbenchPanel({ pendingRequests, onApprove, onReject }: Props) {
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId)
  )

  if (!conversation) {
    return (
      <aside className="workbench-panel">
        <div className="workbench-empty">No active workbench</div>
      </aside>
    )
  }

  const todos = conversation.todos || []
  const agentTasks = conversation.agentTasks || []

  return (
    <aside className="workbench-panel">
      <section className="workbench-section">
        <div className="workbench-section-title">
          <ClipboardList size={15} />
          <span>Plan</span>
        </div>
        {conversation.plan ? (
          <div className="workbench-plan">
            <strong>{conversation.plan.title}</strong>
            <p>{conversation.plan.summary}</p>
            <span className={conversation.plan.approved ? 'status-pill completed' : 'status-pill'}>
              {conversation.plan.approved ? 'Approved' : 'Draft'}
            </span>
          </div>
        ) : (
          <div className="workbench-muted">Use /plan to ask the Coordinator for a plan.</div>
        )}
      </section>

      <section className="workbench-section">
        <div className="workbench-section-title">
          <CheckSquare size={15} />
          <span>Todos</span>
        </div>
        {todos.length > 0 ? (
          <div className="todo-list">
            {todos.map((todo) => (
              <div key={todo.id} className={`todo-item ${todo.status}`}>
                <span className="todo-dot" />
                <span>{todo.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="workbench-muted">No structured todos yet.</div>
        )}
      </section>

      <section className="workbench-section">
        <div className="workbench-section-title">
          <Users size={15} />
          <span>Agents</span>
        </div>
        {agentTasks.length > 0 ? (
          <div className="agent-task-list">
            {agentTasks.map((task) => (
              <div key={task.id} className="agent-task">
                <span className={`status-pill ${task.status}`}>{task.role}</span>
                <strong>{task.title}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="workbench-muted">Coordinator, Explorer, Implementer, Reviewer and Integrator are ready.</div>
        )}
      </section>

      <section className="workbench-section">
        <div className="workbench-section-title">
          <ShieldCheck size={15} />
          <span>Approvals</span>
        </div>
        {pendingRequests.length > 0 ? (
          <div className="approval-list">
            {pendingRequests.map((req) => (
              <ToolCallCard
                key={req.toolCallId}
                request={req}
                onApprove={() => onApprove(req.toolCallId)}
                onReject={() => onReject(req.toolCallId)}
              />
            ))}
          </div>
        ) : (
          <div className="workbench-muted">Every tool call will appear here for confirmation.</div>
        )}
      </section>

      <section className="workbench-section">
        <div className="workbench-section-title">
          <Network size={15} />
          <span>MCP</span>
        </div>
        <div className="workbench-muted">Local stdio MCP servers can be configured in Settings.</div>
      </section>
    </aside>
  )
}
