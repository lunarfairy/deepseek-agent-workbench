import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
import { join, isAbsolute } from 'path'
import { IPC } from '../shared/ipc-channels'
import { loadSettings, saveSettings } from './services/settings-store'
import { loadConversations, saveConversation, deleteConversation } from './services/conversation-store'
import { runChatStream, setApprovalCallback, resolveToolApproval } from './services/deepseek-service'
import { cancelCommandRun, runCommandStream } from './services/terminal-service'
import { discoverMcpTools } from './services/mcp-service'
import type { AppUpdateInfo, ChatStreamContext, McpServerConfig } from '../shared/types'
import {
  PROJECT_LATEST_RELEASE_API_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_URL
} from '../shared/project'

type GitHubReleaseResponse = {
  tag_name?: unknown
  html_url?: unknown
  name?: unknown
  published_at?: unknown
}

const UPDATE_CHECK_TIMEOUT_MS = 10000

export function registerIpcHandlers(): void {
  // ---------- App Metadata ----------
  ipcMain.handle(IPC.GET_APP_INFO, async () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      repositoryUrl: PROJECT_REPOSITORY_URL,
      releasesUrl: PROJECT_RELEASES_URL
    }
  })

  ipcMain.handle(IPC.CHECK_FOR_UPDATES, async () => {
    return checkForUpdates(app.getVersion())
  })

  // ---------- Settings ----------
  ipcMain.handle(IPC.GET_SETTINGS, async () => {
    return loadSettings()
  })

  ipcMain.handle(IPC.SAVE_SETTINGS, async (_, settings) => {
    return saveSettings(settings)
  })

  // ---------- Conversations ----------
  ipcMain.handle(IPC.GET_CONVERSATIONS, async () => {
    return loadConversations()
  })

  ipcMain.handle(IPC.SAVE_CONVERSATION, async (_, conversation) => {
    saveConversation(conversation)
  })

  ipcMain.handle(IPC.DELETE_CONVERSATION, async (_, id) => {
    deleteConversation(id)
  })

  // ---------- Directory Picker ----------
  ipcMain.handle(IPC.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0] || null
  })

  // ---------- Open Path ----------
  ipcMain.handle(IPC.OPEN_IN_EXPLORER, async (_, inputPath: string) => {
    const settings = loadSettings()
    const fullPath = isAbsolute(inputPath) ? inputPath : join(settings.workDirectory, inputPath)
    await shell.showItemInFolder(fullPath)
  })

  ipcMain.handle(IPC.OPEN_FILE, async (_, inputPath: string) => {
    const settings = loadSettings()
    const fullPath = isAbsolute(inputPath) ? inputPath : join(settings.workDirectory, inputPath)
    await shell.openPath(fullPath)
  })

  ipcMain.handle(IPC.OPEN_EXTERNAL_URL, async (_, inputUrl: string) => {
    if (!isAllowedExternalUrl(inputUrl)) {
      throw new Error('External URL is not allowed')
    }
    await shell.openExternal(inputUrl)
  })

  // ---------- Tool Approval ----------
  ipcMain.handle(IPC.RESPOND_TOOL_APPROVAL, async (_, response) => {
    resolveToolApproval(response.toolCallId, response.approved)
  })

  // ---------- Command Runs ----------
  ipcMain.handle(IPC.RUN_COMMAND, async (event, command: string, cwd?: string) => {
    const settings = loadSettings()
    const win = BrowserWindow.fromWebContents(event.sender)
    return runCommandStream(
      { command, cwd },
      settings.workDirectory,
      (run) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC.COMMAND_RUN, run)
        }
      },
      settings.terminal.timeoutMs
    )
  })

  ipcMain.handle(IPC.CANCEL_COMMAND, async (_, id: string) => {
    cancelCommandRun(id)
  })

  // ---------- MCP ----------
  ipcMain.handle(IPC.DISCOVER_MCP_TOOLS, async (_, serverId: string, serverOverride?: McpServerConfig) => {
    const settings = loadSettings()
    return discoverMcpTools(
      serverId,
      serverOverride ? [{ ...serverOverride, enabled: true }] : settings.mcpServers
    )
  })

  // ---------- Chat Streaming via webContents.send ----------
  ipcMain.handle(
    IPC.START_CHAT_STREAM,
    async (event, _conversationId, messages, streamContext?: ChatStreamContext) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      // Send stream chunks to renderer via IPC events
      const sendChunk = (chunk: any) => {
        try {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.STREAM_CHUNK, chunk)
          }
        } catch {
          // window may be closed
        }
      }

      // When AI requests tool approval, send the request to renderer
      setApprovalCallback((req) => {
        try {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.ON_TOOL_APPROVAL_REQUEST, req)
          }
        } catch {
          // window may be closed
        }
      })

      // Run the stream
      runChatStream(messages, streamContext, sendChunk).catch((err) => {
        sendChunk({ type: 'error', error: err.message })
        sendChunk({ type: 'done' })
      })
    }
  )
}

async function checkForUpdates(currentVersion: string): Promise<AppUpdateInfo> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const checkedAt = Date.now()

  try {
    const controller = new AbortController()
    timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS)
    const response = await fetch(PROJECT_LATEST_RELEASE_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DeepSeek-Agent-Workbench'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseUrl: PROJECT_RELEASES_URL,
        checkedAt,
        error:
          response.status === 404
            ? 'No published GitHub release was found yet.'
            : `GitHub release check failed with HTTP ${response.status}.`
      }
    }

    const release = (await response.json()) as GitHubReleaseResponse
    const tagName = typeof release.tag_name === 'string' ? release.tag_name : ''
    const latestVersion = normalizeVersion(tagName)
    const releaseUrl = typeof release.html_url === 'string' ? release.html_url : PROJECT_RELEASES_URL

    if (!latestVersion) {
      return {
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseUrl,
        checkedAt,
        error: 'The latest GitHub release does not include a version tag.'
      }
    }

    return {
      currentVersion,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      releaseUrl,
      releaseName: typeof release.name === 'string' ? release.name : undefined,
      publishedAt: typeof release.published_at === 'string' ? release.published_at : undefined,
      checkedAt
    }
  } catch (err: any) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: PROJECT_RELEASES_URL,
      checkedAt,
      error:
        err?.name === 'AbortError'
          ? 'GitHub release check timed out.'
          : err?.message || 'GitHub release check failed.'
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '').split('+')[0].split('-')[0]
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0
    const rightValue = rightParts[index] || 0
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1
  }

  return 0
}

function parseVersion(version: string): number[] {
  const normalized = normalizeVersion(version)
  if (!/^\d+(\.\d+)*$/.test(normalized)) return [0]
  return normalized.split('.').map((part) => Number(part))
}

function isAllowedExternalUrl(inputUrl: string): boolean {
  try {
    const url = new URL(inputUrl)
    const repositoryUrl = new URL(PROJECT_REPOSITORY_URL)
    return (
      url.protocol === 'https:' &&
      url.hostname === repositoryUrl.hostname &&
      (url.pathname === repositoryUrl.pathname ||
        url.pathname.startsWith(`${repositoryUrl.pathname}/`))
    )
  } catch {
    return false
  }
}
