import { FormEvent, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Play, Terminal, X } from 'lucide-react'
import { useConversationStore } from '../../store/conversation-store'

export function CommandOutputPanel() {
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId)
  )
  const upsertCommandRun = useConversationStore((s) => s.upsertCommandRun)
  const saveConversationById = useConversationStore((s) => s.saveConversationById)
  const [command, setCommand] = useState('')
  const [pendingCommand, setPendingCommand] = useState('')
  const runs = conversation?.commandRuns || []
  const latestRuns = runs.slice(-3).reverse()

  useEffect(() => {
    if (!conversation) return undefined
    return window.api.onCommandRun((run) => {
      upsertCommandRun(conversation.id, run)
      if (run.status !== 'running') {
        window.setTimeout(() => saveConversationById(conversation.id), 0)
      }
    })
  }, [conversation?.id, saveConversationById, upsertCommandRun])

  if (!conversation) return null

  const runCommand = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = command.trim()
    if (!trimmed) return

    if (pendingCommand !== trimmed) {
      setPendingCommand(trimmed)
      return
    }

    setPendingCommand('')
    setCommand('')
    try {
      const run = await window.api.runCommand(trimmed)
      upsertCommandRun(conversation.id, run)
      await saveConversationById(conversation.id)
    } catch (err: any) {
      upsertCommandRun(conversation.id, {
        id: uuid(),
        command: trimmed,
        cwd: '',
        status: 'failed',
        stdout: '',
        stderr: err?.message || 'Command failed',
        startedAt: Date.now(),
        finishedAt: Date.now(),
        exitCode: null
      })
      await saveConversationById(conversation.id)
    }
  }

  return (
    <div className="command-output-panel">
      <div className="command-output-header">
        <div>
          <Terminal size={14} />
          <span>Command Output</span>
        </div>
        <span>{latestRuns.length} recent</span>
      </div>
      <form className="command-run-form" onSubmit={runCommand}>
        <input
          value={command}
          onChange={(event) => {
            setCommand(event.target.value)
            if (pendingCommand && event.target.value.trim() !== pendingCommand) {
              setPendingCommand('')
            }
          }}
          placeholder="Run a command..."
        />
        <button type="submit" disabled={!command.trim()} title="Run command">
          <Play size={13} />
          <span>{pendingCommand === command.trim() ? 'Confirm' : 'Run'}</span>
        </button>
      </form>
      {pendingCommand && (
        <div className="command-confirm">
          Confirm command execution: <code>{pendingCommand}</code>
        </div>
      )}
      <div className="command-output-body">
        {latestRuns.length > 0 ? (
          latestRuns.map((run) => (
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
          ))
        ) : (
          <div className="command-empty">(no commands yet)</div>
        )}
      </div>
    </div>
  )
}
