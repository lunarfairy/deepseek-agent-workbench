import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { join, isAbsolute } from 'path'
import { IPC } from '../shared/ipc-channels'
import { loadSettings, saveSettings } from './services/settings-store'
import { loadConversations, saveConversation, deleteConversation } from './services/conversation-store'
import { runChatStream, setApprovalCallback, resolveToolApproval } from './services/deepseek-service'

export function registerIpcHandlers(): void {
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

  // ---------- Tool Approval ----------
  ipcMain.handle(IPC.RESPOND_TOOL_APPROVAL, async (_, response) => {
    resolveToolApproval(response.toolCallId, response.approved)
  })

  // ---------- Chat Streaming via webContents.send ----------
  ipcMain.handle(IPC.START_CHAT_STREAM, async (event, _conversationId, messages) => {
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
    runChatStream(messages, sendChunk).catch((err) => {
      sendChunk({ type: 'error', error: err.message })
      sendChunk({ type: 'done' })
    })
  })
}
