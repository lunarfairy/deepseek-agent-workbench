import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import type { Conversation } from '../../shared/types'

const CONVOS_DIR = join(app.getPath('userData'), 'data', 'conversations')

function ensureDir(): void {
  if (!existsSync(CONVOS_DIR)) {
    mkdirSync(CONVOS_DIR, { recursive: true })
  }
}

export function loadConversations(): Conversation[] {
  try {
    ensureDir()
    const files = readdirSync(CONVOS_DIR).filter((f) => f.endsWith('.json'))
    const conversations = files.map((f) => {
      const data = readFileSync(join(CONVOS_DIR, f), 'utf-8')
      return JSON.parse(data) as Conversation
    })
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function saveConversation(conversation: Conversation): void {
  ensureDir()
  const filePath = join(CONVOS_DIR, `${conversation.id}.json`)
  writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8')
}

export function deleteConversation(id: string): void {
  const filePath = join(CONVOS_DIR, `${id}.json`)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}
