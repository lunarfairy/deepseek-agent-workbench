import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, FolderOpen } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'

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

  const isV4Model = model.startsWith('deepseek-v4-') || model === 'deepseek-chat' || model === 'deepseek-reasoner'

  const handleSave = async () => {
    await updateSettings({ apiKey, model, workDirectory: workDir, systemPrompt, reasoningEffort, thinkingEnabled })
    onClose()
  }

  const handleSelectDir = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) setWorkDir(dir)
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
