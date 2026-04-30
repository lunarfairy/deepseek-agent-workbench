import {
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Network,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  ThumbsUp,
  Users,
  XCircle
} from 'lucide-react'
import type {
  AgentTask,
  AgentTaskStatus,
  TodoItem,
  TodoStatus,
  ToolApprovalRequest
} from '../../../../shared/types'
import { useSettingsStore } from '../../store/settings-store'
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
  const setPlan = useConversationStore((s) => s.setPlan)
  const setTodos = useConversationStore((s) => s.setTodos)
  const setAgentTasks = useConversationStore((s) => s.setAgentTasks)
  const updateAgentTaskStatus = useConversationStore((s) => s.updateAgentTaskStatus)
  const saveConversationById = useConversationStore((s) => s.saveConversationById)
  const mcpServers = useSettingsStore((s) => s.settings.mcpServers)

  if (!conversation) {
    return (
      <aside className="workbench-panel">
        <div className="workbench-empty">No active workbench</div>
      </aside>
    )
  }

  const todos = conversation.todos || []
  const agentTasks = conversation.agentTasks || []
  const enabledMcpServers = mcpServers.filter((server) => server.enabled && server.command.trim())
  const saveSoon = () => window.setTimeout(() => saveConversationById(conversation.id), 0)
  const approvePlan = () => {
    if (!conversation.plan) return
    setPlan(conversation.id, { ...conversation.plan, approved: true, updatedAt: Date.now() })
    saveSoon()
  }
  const resetPlan = () => {
    setPlan(conversation.id, null)
    setTodos(conversation.id, [])
    setAgentTasks(conversation.id, [])
    saveSoon()
  }
  const cycleTodo = (todo: TodoItem) => {
    const next: Record<TodoStatus, TodoStatus> = {
      pending: 'in_progress',
      in_progress: 'completed',
      completed: 'pending'
    }
    setTodos(
      conversation.id,
      todos.map((candidate) =>
        candidate.id === todo.id ? { ...candidate, status: next[candidate.status] } : candidate
      )
    )
    saveSoon()
  }
  const setTaskStatus = (task: AgentTask, status: AgentTaskStatus) => {
    updateAgentTaskStatus(conversation.id, task.id, status)
    saveSoon()
  }

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
            <div className="workbench-action-row">
              {!conversation.plan.approved && (
                <button className="workbench-icon-btn" onClick={approvePlan} title="Approve plan">
                  <ThumbsUp size={13} />
                  Approve
                </button>
              )}
              <button className="workbench-icon-btn" onClick={resetPlan} title="Reset plan">
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
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
              <button
                key={todo.id}
                className={`todo-item ${todo.status}`}
                onClick={() => cycleTodo(todo)}
                title="Advance todo status"
              >
                {todo.status === 'completed' ? (
                  <CheckCircle2 size={14} />
                ) : todo.status === 'in_progress' ? (
                  <PlayCircle size={14} />
                ) : (
                  <span className="todo-dot" />
                )}
                <span>{todo.content}</span>
              </button>
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
                <div className="agent-task-header">
                  <span className={`status-pill ${task.status}`}>{task.role}</span>
                  <span className={`agent-task-status ${task.status}`}>{task.status}</span>
                </div>
                <strong>{task.title}</strong>
                {task.result && <p>{task.result}</p>}
                {task.error && <p className="agent-task-error">{task.error}</p>}
                <div className="agent-task-actions">
                  <button onClick={() => setTaskStatus(task, 'running')} title="Mark running">
                    <PlayCircle size={12} />
                  </button>
                  <button onClick={() => setTaskStatus(task, 'completed')} title="Mark complete">
                    <CheckCircle2 size={12} />
                  </button>
                  <button onClick={() => setTaskStatus(task, 'failed')} title="Mark failed">
                    <XCircle size={12} />
                  </button>
                  <button onClick={() => setTaskStatus(task, 'pending')} title="Reset task">
                    <RotateCcw size={12} />
                  </button>
                </div>
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
        {enabledMcpServers.length > 0 ? (
          <div className="mcp-server-list">
            {enabledMcpServers.map((server) => (
              <div key={server.id} className="mcp-server-chip">
                <span>{server.name || server.id}</span>
                <code>{server.command}</code>
              </div>
            ))}
          </div>
        ) : (
          <div className="workbench-muted">Local stdio MCP servers can be configured in Settings.</div>
        )}
      </section>
    </aside>
  )
}
