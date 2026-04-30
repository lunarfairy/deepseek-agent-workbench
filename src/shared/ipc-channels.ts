// IPC Channel Constants

export const IPC = {
  // App metadata
  GET_APP_INFO: 'get-app-info',
  CHECK_FOR_UPDATES: 'check-for-updates',

  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',

  // Conversations
  GET_CONVERSATIONS: 'get-conversations',
  SAVE_CONVERSATION: 'save-conversation',
  DELETE_CONVERSATION: 'delete-conversation',

  // Chat streaming
  START_CHAT_STREAM: 'start-chat-stream',

  // Tool approval
  ON_TOOL_APPROVAL_REQUEST: 'on-tool-approval-request',
  RESPOND_TOOL_APPROVAL: 'respond-tool-approval',

  // Dialogs
  SELECT_DIRECTORY: 'select-directory',

  // Open path in explorer / editor
  OPEN_IN_EXPLORER: 'open-in-explorer',
  OPEN_FILE: 'open-file',
  OPEN_EXTERNAL_URL: 'open-external-url',

  // Window controls
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE: 'window-maximize',
  WINDOW_CLOSE: 'window-close',

  // Streaming events (MessagePort)
  STREAM_CHUNK: 'stream-chunk',

  // Command runs
  RUN_COMMAND: 'run-command',
  CANCEL_COMMAND: 'cancel-command',
  COMMAND_RUN: 'command-run',

  // MCP
  DISCOVER_MCP_TOOLS: 'discover-mcp-tools'
} as const
