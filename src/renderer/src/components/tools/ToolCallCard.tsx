import type { ToolApprovalRequest, ToolRisk } from '../../../../shared/types'
import {
  CheckCircle,
  ExternalLink,
  FilePenLine,
  FileSearch,
  FolderOpen,
  PlugZap,
  Search,
  ShieldAlert,
  Terminal,
  Wrench,
  XCircle
} from 'lucide-react'

interface Props {
  request: ToolApprovalRequest
  onApprove: () => void
  onReject: () => void
}

function formatToolName(name: string): string {
  if (name.startsWith('mcp__')) return name.replace(/^mcp__/, 'mcp / ').replace(/__/g, ' / ')
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
  const risk = request.risk || inferRisk(request.toolName)
  const isCommand = request.toolName === 'execute_command'
  const isWrite = request.toolName === 'write_file' || request.toolName === 'apply_patch'
  const hasPath = args.path && typeof args.path === 'string'
  const Icon = getToolIcon(request.toolName, risk)

  return (
    <div className={`tool-call-card risk-${risk}`}>
      <div className="tool-call-header">
        <Icon size={15} className="tool-call-icon" />
        <span className="tool-call-name">{formatToolName(request.toolName)}</span>
        <span className={`tool-risk-badge risk-${risk}`}>{risk}</span>
      </div>
      {request.summary && <div className="tool-call-summary">{request.summary}</div>}
      <div className="tool-call-args">
        {isCommand ? (
          <>
            <code className="tool-command">{args.command}</code>
            {args.cwd && <div className="tool-cwd">cwd: {args.cwd}</div>}
          </>
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
            {args.content && <pre className="tool-file-content">{args.content}</pre>}
            {args.search && (
              <pre className="tool-file-content">{JSON.stringify({ search: args.search, replace: args.replace }, null, 2)}</pre>
            )}
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

function inferRisk(name: string): ToolRisk {
  if (name.startsWith('mcp__')) return 'mcp'
  if (name === 'execute_command') return 'command'
  if (name === 'write_file' || name === 'apply_patch') return 'write'
  return 'read'
}

function getToolIcon(name: string, risk: ToolRisk) {
  if (risk === 'command') return Terminal
  if (risk === 'mcp') return PlugZap
  if (risk === 'write') return FilePenLine
  if (name === 'grep' || name === 'search_files') return Search
  if (name === 'list_files' || name === 'stat_path') return FolderOpen
  if (name === 'read_file' || name === 'read_many') return FileSearch
  if (risk === 'read') return FileSearch
  return risk === 'command' ? ShieldAlert : Wrench
}