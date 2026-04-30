import { Terminal, X } from 'lucide-react'
import { useConversationStore } from '../../store/conversation-store'

export function CommandOutputPanel() {
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId)
  )
  const runs = conversation?.commandRuns || []
  const latestRuns = runs.slice(-3).reverse()

  if (latestRuns.length === 0) return null

  return (
    <div className="command-output-panel">
      <div className="command-output-header">
        <div>
          <Terminal size={14} />
          <span>Command Output</span>
        </div>
        <span>{latestRuns.length} recent</span>
      </div>
      <div className="command-output-body">
        {latestRuns.map((run) => (
          <div key={run.id} className="command-run">
            <div className="command-run-title">
              <code>{run.command}</code>
              <span className={`status-pill ${run.status}`}>{run.status}</span>
              {run.status === 'running' && (
                <button className="command-cancel-btn" onClick={() => window.api.cancelCommand(run.id)}>
                  <X size={12} />
                </button>
              )}
            </div>
            <pre>{[run.stdout, run.stderr && `[stderr]\n${run.stderr}`].filter(Boolean).join('\n') || '(no output yet)'}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}
