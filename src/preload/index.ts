import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  CommandRun,
  ElectronAPI,
  StreamChunk,
  ToolApprovalRequest,
  ToolApprovalResponse
} from '../shared/types'

const api: ElectronAPI = {
  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),

  // Conversations
  getConversations: () => ipcRenderer.invoke(IPC.GET_CONVERSATIONS),
  saveConversation: (conversation) => ipcRenderer.invoke(IPC.SAVE_CONVERSATION, conversation),
  deleteConversation: (id) => ipcRenderer.invoke(IPC.DELETE_CONVERSATION, id),

  // Chat streaming
  startChatStream: (conversationId, messages, context) =>
    ipcRenderer.invoke(IPC.START_CHAT_STREAM, conversationId, messages, context),

  // Tool approval — main pushes request to renderer via IPC event
  onToolApprovalRequest: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, request: ToolApprovalRequest) => {
      callback(request)
    }
    ipcRenderer.on(IPC.ON_TOOL_APPROVAL_REQUEST, listener)
    return () => {
      ipcRenderer.removeListener(IPC.ON_TOOL_APPROVAL_REQUEST, listener)
    }
  },

  // Tool approval — renderer sends response back via IPC invoke
  respondToolApproval: (response: ToolApprovalResponse) => {
    return ipcRenderer.invoke(IPC.RESPOND_TOOL_APPROVAL, response)
  },

  // Command runs
  runCommand: (command: string, cwd?: string) => ipcRenderer.invoke(IPC.RUN_COMMAND, command, cwd),
  cancelCommand: (id: string) => ipcRenderer.invoke(IPC.CANCEL_COMMAND, id),
  onCommandRun: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, run: CommandRun) => {
      callback(run)
    }
    ipcRenderer.on(IPC.COMMAND_RUN, listener)
    return () => {
      ipcRenderer.removeListener(IPC.COMMAND_RUN, listener)
    }
  },

  // MCP
  discoverMcpTools: (serverId, server) => ipcRenderer.invoke(IPC.DISCOVER_MCP_TOOLS, serverId, server),

  // Dialogs
  selectDirectory: () => ipcRenderer.invoke(IPC.SELECT_DIRECTORY),

  // Open paths
  openInExplorer: (path: string) => ipcRenderer.invoke(IPC.OPEN_IN_EXPLORER, path),
  openFile: (path: string) => ipcRenderer.invoke(IPC.OPEN_FILE, path),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL_URL, url),

  // Window controls
  windowMinimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.send(IPC.WINDOW_CLOSE),

  // Streaming events — main pushes chunks to renderer via IPC event
  onStreamChunk: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, chunk: StreamChunk) => {
      callback(chunk)
    }
    ipcRenderer.on(IPC.STREAM_CHUNK, listener)
    return () => {
      ipcRenderer.removeListener(IPC.STREAM_CHUNK, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
