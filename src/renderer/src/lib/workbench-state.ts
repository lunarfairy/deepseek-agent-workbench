import { v4 as uuid } from 'uuid'
import type {
  AgentPlan,
  AgentRole,
  AgentTask,
  AgentTaskStatus,
  TodoItem,
  TodoStatus,
  WorkbenchStateUpdate
} from '../../../shared/types'

interface ExistingWorkbenchState {
  plan?: AgentPlan | null
  todos?: TodoItem[]
  agentTasks?: AgentTask[]
}

interface ParsedWorkbenchState {
  content: string
  found: boolean
  plan?: AgentPlan
  todos?: TodoItem[]
  agentTasks?: AgentTask[]
}

const WORKBENCH_BLOCK = /```(?:workbench_state|workbench|agent_plan)(?:\s+json)?\s*\n([\s\S]*?)```/gi
const AGENT_ROLES = new Set<AgentRole>([
  'coordinator',
  'explorer',
  'implementer',
  'reviewer',
  'integrator',
  'mcp'
])

export function parseWorkbenchState(
  content: string,
  existing: ExistingWorkbenchState = {}
): ParsedWorkbenchState {
  const payloads: WorkbenchStateUpdate[] = []
  let found = false

  const cleaned = content
    .replace(WORKBENCH_BLOCK, (block, json) => {
      try {
        const payload = JSON.parse(json.trim()) as WorkbenchStateUpdate
        payloads.push(payload)
        found = true
        return ''
      } catch {
        return block
      }
    })
    .trim()

  if (payloads.length === 0) {
    return { content, found: false }
  }

  const now = Date.now()
  let plan = existing.plan || undefined
  let todos = existing.todos
  let agentTasks = existing.agentTasks

  for (const payload of payloads) {
    if (payload.plan) {
      plan = normalizePlan(payload.plan, plan, now)
    }

    if (Array.isArray(payload.todos)) {
      todos = payload.todos
        .map((todo) => normalizeTodo(todo, existing.todos || [], now))
        .filter((todo): todo is TodoItem => Boolean(todo))
    }

    const rawTasks = Array.isArray(payload.agentTasks) ? payload.agentTasks : []
    if (rawTasks.length > 0) {
      agentTasks = rawTasks
        .map((task) => normalizeAgentTask(task, existing.agentTasks || [], now))
        .filter((task): task is AgentTask => Boolean(task))
    }
  }

  return {
    content: cleaned || 'Workbench updated.',
    found,
    plan,
    todos,
    agentTasks
  }
}

function normalizePlan(
  raw: NonNullable<WorkbenchStateUpdate['plan']>,
  existing: AgentPlan | undefined,
  now: number
): AgentPlan {
  return {
    id: existing?.id || uuid(),
    title: text(raw.title) || existing?.title || 'Agent plan',
    summary: text(raw.summary) || existing?.summary || '',
    approved: typeof raw.approved === 'boolean' ? raw.approved : existing?.approved || false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
}

function normalizeTodo(
  raw: NonNullable<WorkbenchStateUpdate['todos']>[number],
  existingTodos: TodoItem[],
  _now: number
): TodoItem | null {
  const content = typeof raw === 'string' ? raw : text(raw.content)
  if (!content) return null

  const existing =
    (typeof raw !== 'string' && raw.id
      ? existingTodos.find((todo) => todo.id === raw.id)
      : undefined) || existingTodos.find((todo) => todo.content === content)

  return {
    id: typeof raw !== 'string' && raw.id ? raw.id : existing?.id || uuid(),
    content,
    status: typeof raw === 'string' ? existing?.status || 'pending' : todoStatus(raw.status, existing?.status)
  }
}

function normalizeAgentTask(
  raw: NonNullable<WorkbenchStateUpdate['agentTasks']>[number],
  existingTasks: AgentTask[],
  now: number
): AgentTask | null {
  const role = agentRole(raw.role)
  const title = text(raw.title)
  if (!role || !title) return null

  const existing =
    (raw.id ? existingTasks.find((task) => task.id === raw.id) : undefined) ||
    existingTasks.find((task) => task.role === role && task.title === title)

  return {
    id: raw.id || existing?.id || uuid(),
    role,
    title,
    status: agentTaskStatus(raw.status, existing?.status),
    result: text(raw.result) || existing?.result,
    error: text(raw.error) || existing?.error,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function agentRole(value: unknown): AgentRole | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase() as AgentRole
  return AGENT_ROLES.has(normalized) ? normalized : null
}

function todoStatus(value: unknown, fallback?: TodoStatus): TodoStatus {
  if (typeof value !== 'string') return fallback || 'pending'
  const normalized = value.trim().toLowerCase().replace('-', '_')
  if (normalized === 'done' || normalized === 'complete') return 'completed'
  if (normalized === 'doing' || normalized === 'active') return 'in_progress'
  if (normalized === 'pending' || normalized === 'in_progress' || normalized === 'completed') {
    return normalized
  }
  return fallback || 'pending'
}

function agentTaskStatus(value: unknown, fallback?: AgentTaskStatus): AgentTaskStatus {
  if (typeof value !== 'string') return fallback || 'pending'
  const normalized = value.trim().toLowerCase().replace('-', '_')
  if (normalized === 'queued') return 'pending'
  if (normalized === 'done' || normalized === 'complete') return 'completed'
  if (normalized === 'doing' || normalized === 'active' || normalized === 'in_progress') return 'running'
  if (normalized === 'canceled') return 'cancelled'
  if (
    normalized === 'pending' ||
    normalized === 'running' ||
    normalized === 'completed' ||
    normalized === 'failed' ||
    normalized === 'cancelled'
  ) {
    return normalized
  }
  return fallback || 'pending'
}
