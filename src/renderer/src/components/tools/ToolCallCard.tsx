import type { ToolApprovalRequest } from '../../../../shared/types'
import { CheckCircle, XCircle, ExternalLink, FolderOpen } from 'lucide-react'

interface Props {
  request: ToolApprovalRequest
  onApprove: () => void
  onReject: () => void
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseArgs(argsStr: string): Record<string, any> {
  try {
    return JSON.parse(argsStr)
  } catch {
    return { raw: argsStr }
  }
}

export function ToolCallCard({ request, onApprove, onReject }: Props) {
  const args = parseArgs(request.args)
  const isCommand = request.toolName === 'execute_command'
  const isWrite = request.toolName === 'write_file'
  const hasPath = args.path && typeof args.path === 'string'

  return (
    <div className="tool-call-card">
      <div className="tool-call-header">
        <span className="tool-call-icon">🔧</span>
        <span className="tool-call-name">{formatToolName(request.toolName)}</span>
      </div>
      <div className="tool-call-args">
        {isCommand ? (
          <code className="tool-command">{args.command}</code>
        ) : isWrite ? (
          <>
            <div className="tool-arg">
              <strong>Path:</strong>{' '}
              <span
                className="tool-path-link"
                onClick={() => { if (hasPath) window.api.openInExplorer(args.path) }}
                title="Open in Explorer"
              >
                {args.path}
                <ExternalLink size={12} />
              </span>
            </div>
            <pre className="tool-file-content">{args.content}</pre>
          </>
        ) : (
          <>
            {hasPath && (
              <div className="tool-arg">
                <strong>Path:</strong>{' '}
                <span
                  className="tool-path-link"
                  onClick={() => window.api.openInExplorer(args.path)}
                  title="Open in Explorer"
                >
                  {args.path}
                  <ExternalLink size={12} />
                </span>
              </div>
            )}
            {!hasPath && <pre>{JSON.stringify(args, null, 2)}</pre>}
          </>
        )}
      </div>
      <div className="tool-call-actions">
        <button className="tool-approve-btn" onClick={onApprove}>
          <CheckCircle size={14} />
          Approve
        </button>
        <button className="tool-reject-btn" onClick={onReject}>
          <XCircle size={14} />
          Reject
        </button>
      </div>
    </div>
  )
}
