import { useState } from 'react'
import { X, Eye, EyeOff, FolderOpen, RotateCcw, Plus } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'
import { DEFAULT_AGENT_PROFILES } from '../../../../shared/types'

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [model, setModel] = useState(settings.model)
  const [workDir, setWorkDir] = useState(settings.workDirectory)
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt)
  const [showKey, setShowKey] = useState(false)
  const [reasoningEffort, setReasoningEffort] = useState(settings.reasoningEffort)
  const [thinkingEnabled, setThinkingEnabled] = useState(settings.thinkingEnabled)
  const [planFirstEnabled, setPlanFirstEnabled] = useState(settings.planFirstEnabled)
  const [agentConcurrency, setAgentConcurrency] = useState(settings.agentConcurrency)
  const [agentProfiles, setAgentProfiles] = useState(settings.agentProfiles)
  const [mcpServers, setMcpServers] = useState(settings.mcpServers)
  const [terminalTimeoutMs, setTerminalTimeoutMs] = useState(settings.terminal.timeoutMs)

  const isV4Model = model.startsWith('deepseek-v4-') || model === 'deepseek-chat' || model === 'deepseek-reasoner'

  const handleSave = async () => {
    await updateSettings({
      apiKey,
      model,
      workDirectory: workDir,
      systemPrompt,
      reasoningEffort,
      thinkingEnabled,
      planFirstEnabled,
      agentConcurrency,
      agentProfiles,
      mcpServers,
      approvalPolicy: 'always',
      terminal: { ...settings.terminal, timeoutMs: terminalTimeoutMs }
    })
    onClose()
  }

  const handleSelectDir = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) setWorkDir(dir)
  }

  const updateAgentPrompt = (role: string, prompt: string) => {
    setAgentProfiles((profiles) =>
      profiles.map((profile) => (profile.role === role ? { ...profile, prompt } : profile))
    )
  }

  const addMcpServer = () => {
    setMcpServers((servers) => [
      ...servers,
      {
        id: `mcp-${Date.now()}`,
        name: 'Local MCP',
        command: '',
        args: [],
        enabled: true
      }
    ])
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Settings</h2>
          <button className="dialog-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="setting-group">
            <label className="setting-label">API Key</label>
            <div className="setting-input-row">
              <input
                type={showKey ? 'text' : 'password'}
                className="setting-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <button className="setting-icon-btn" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">Model</label>
            <select
              className="setting-input"
              value={model.startsWith('__') ? model : model}
              onChange={(e) => setModel(e.target.value)}
            >
              <optgroup label="V4 Models">
                <option value="deepseek-v4-flash">deepseek-v4-flash (Fast & Capable)</option>
                <option value="deepseek-v4-pro">deepseek-v4-pro (Most Powerful)</option>
              </optgroup>
              <optgroup label="Legacy Models">
                <option value="deepseek-chat">deepseek-chat (V3)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
              </optgroup>
              <optgroup label="Other">
                <option value="__custom__">Custom model...</option>
              </optgroup>
            </select>
            {model === '__custom__' && (
              <input
                type="text"
                className="setting-input"
                placeholder="Enter custom model name..."
                onChange={(e) => { if (e.target.value.trim()) setModel(e.target.value.trim()) }}
                autoFocus
              />
            )}
          </div>

          {isV4Model && (
            <div className="setting-group">
              <label className="setting-label">Thinking Mode</label>
              <div className="setting-input-row">
                <label className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={thinkingEnabled}
                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                  />
                  <span>Enable thinking (shows AI reasoning process)</span>
                </label>
              </div>
            </div>
          )}

          {isV4Model && (
            <div className="setting-group">
              <label className="setting-label">Reasoning Effort</label>
              <div className="reasoning-effort-row">
                {(['high', 'max'] as const).map((level) => (
                  <button
                    key={level}
                    className={`effort-btn ${reasoningEffort === level ? 'active' : ''}`}
                    onClick={() => setReasoningEffort(level)}
                  >
                    <span className="effort-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                    <span className="effort-desc">
                      {level === 'high' ? 'Balanced' : 'Deepest thinking'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="setting-group">
            <label className="setting-label">Working Directory</label>
            <div className="setting-input-row">
              <input
                type="text"
                className="setting-input"
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                placeholder="Select or type a directory path..."
              />
              <button className="setting-icon-btn" onClick={handleSelectDir}>
                <FolderOpen size={16} />
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">System Prompt</label>
            <textarea
              className="setting-textarea"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
            />
          </div>

          <div className="settings-divider" />

          <div className="setting-group">
            <label className="setting-label">Agent Workbench</label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={planFirstEnabled}
                onChange={(e) => setPlanFirstEnabled(e.target.checked)}
              />
              <span>Enable Plan-first mode</span>
            </label>
            <input
              type="number"
              min={1}
              max={6}
              className="setting-input"
              value={agentConcurrency}
              onChange={(e) => setAgentConcurrency(Number(e.target.value) || 1)}
              placeholder="Agent concurrency"
            />
            <div className="setting-hint">Approval policy is fixed to confirm every tool call.</div>
          </div>

          <div className="setting-group">
            <div className="setting-label-row">
              <label className="setting-label">Agent Prompt Profiles</label>
              <button
                className="setting-small-btn"
                onClick={() => setAgentProfiles(DEFAULT_AGENT_PROFILES)}
                title="Reset prompts"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
            {agentProfiles.map((profile) => (
              <div key={profile.role} className="agent-profile-editor">
                <div className="agent-profile-header">
                  <strong>{profile.name}</strong>
                  <label className="setting-toggle">
                    <input
                      type="checkbox"
                      checked={profile.enabled}
                      onChange={(e) =>
                        setAgentProfiles((profiles) =>
                          profiles.map((candidate) =>
                            candidate.role === profile.role
                              ? { ...candidate, enabled: e.target.checked }
                              : candidate
                          )
                        )
                      }
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <textarea
                  className="setting-textarea agent-prompt-textarea"
                  value={profile.prompt}
                  onChange={(e) => updateAgentPrompt(profile.role, e.target.value)}
                  rows={4}
                />
              </div>
            ))}
          </div>

          <div className="setting-group">
            <label className="setting-label">Terminal</label>
            <input
              type="number"
              min={1000}
              className="setting-input"
              value={terminalTimeoutMs}
              onChange={(e) => setTerminalTimeoutMs(Number(e.target.value) || 30000)}
              placeholder="Command timeout in ms"
            />
          </div>

          <div className="setting-group">
            <div className="setting-label-row">
              <label className="setting-label">Local MCP Servers</label>
              <button className="setting-small-btn" onClick={addMcpServer}>
                <Plus size={13} />
                Add
              </button>
            </div>
            {mcpServers.length === 0 && <div className="setting-hint">No MCP servers configured.</div>}
            {mcpServers.map((server) => (
              <div key={server.id} className="mcp-server-editor">
                <label className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(e) =>
                      setMcpServers((servers) =>
                        servers.map((candidate) =>
                          candidate.id === server.id ? { ...candidate, enabled: e.target.checked } : candidate
                        )
                      )
                    }
                  />
                  <span>Enabled</span>
                </label>
                <input
                  className="setting-input"
                  value={server.name}
                  onChange={(e) =>
                    setMcpServers((servers) =>
                      servers.map((candidate) =>
                        candidate.id === server.id ? { ...candidate, name: e.target.value } : candidate
                      )
                    )
                  }
                  placeholder="Server name"
                />
                <input
                  className="setting-input"
                  value={server.command}
                  onChange={(e) =>
                    setMcpServers((servers) =>
                      servers.map((candidate) =>
                        candidate.id === server.id ? { ...candidate, command: e.target.value } : candidate
                      )
                    )
                  }
                  placeholder="Command"
                />
                <input
                  className="setting-input"
                  value={server.args.join(' ')}
                  onChange={(e) =>
                    setMcpServers((servers) =>
                      servers.map((candidate) =>
                        candidate.id === server.id
                          ? { ...candidate, args: e.target.value.split(' ').filter(Boolean) }
                          : candidate
                      )
                    )
                  }
                  placeholder="Args separated by spaces"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
