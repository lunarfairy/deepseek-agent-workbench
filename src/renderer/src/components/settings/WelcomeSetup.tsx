import { useState } from 'react'
import { Eye, EyeOff, FolderOpen, ChevronRight } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'

interface Props {
  onComplete: () => void
}

export function WelcomeSetup({ onComplete }: Props) {
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [step, setStep] = useState(0) // 0=welcome, 1=apikey, 2=model, 3=workdir
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [workDir, setWorkDir] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState<'high' | 'max'>('high')
  const [thinkingEnabled, setThinkingEnabled] = useState(true)

  const isV4Model = model.startsWith('deepseek-v4-') || model === 'deepseek-chat' || model === 'deepseek-reasoner'

  const handleSelectDir = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) setWorkDir(dir)
  }

  const handleFinish = async () => {
    if (!apiKey.trim()) {
      setError('API Key is required')
      return
    }
    await updateSettings({
      apiKey: apiKey.trim(),
      model,
      workDirectory: workDir,
      reasoningEffort,
      thinkingEnabled
    })
    onComplete()
  }

  return (
    <div className="welcome-overlay">
      <div className="welcome-dialog">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <>
            <div className="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="welcome-title">Welcome to DeepSeek Agent Workbench</h1>
            <p className="welcome-desc">
              An unofficial local agent app for DeepSeek API users with plan-first workflows, tool approval, MCP, and agent profiles.
            </p>
            <button className="welcome-next-btn" onClick={() => setStep(1)}>
              Get Started
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Step 1: API Key */}
        {step === 1 && (
          <>
            <div className="welcome-step-badge">Step 1 of 3</div>
            <h2 className="welcome-step-title">Enter your DeepSeek API Key</h2>
            <p className="welcome-step-desc">
              Get your API key from{' '}
              <span className="welcome-link">platform.deepseek.com</span>
            </p>
            <div className="welcome-input-row">
              <input
                type={showKey ? 'text' : 'password'}
                className="welcome-input"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError('') }}
                placeholder="sk-..."
                autoFocus
              />
              <button className="setting-icon-btn" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <div className="welcome-error">{error}</div>}
            <div className="welcome-actions">
              <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button className="welcome-next-btn" onClick={() => { if (!apiKey.trim()) { setError('API Key is required'); return; } setStep(2); }}>
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* Step 2: Model */}
        {step === 2 && (
          <>
            <div className="welcome-step-badge">Step 2 of 3</div>
            <h2 className="welcome-step-title">Choose a Model</h2>
            <p className="welcome-step-desc">
              Select the DeepSeek model you'd like to use. You can change this later.
            </p>
            <div className="welcome-model-grid">
              {[
                { id: 'deepseek-v4-flash', name: 'V4 Flash', desc: 'Fast & capable, great for most tasks', tag: 'Recommended' },
                { id: 'deepseek-v4-pro', name: 'V4 Pro', desc: 'Most powerful, flagship model', tag: 'Pro' },
                { id: 'deepseek-chat', name: 'Chat V3', desc: 'General-purpose, fast & versatile', tag: 'Legacy' },
                { id: 'deepseek-reasoner', name: 'Reasoner R1', desc: 'Deep reasoning for complex tasks', tag: 'Legacy' },
              ].map((m) => (
                <div
                  key={m.id}
                  className={`welcome-model-card ${model === m.id ? 'active' : ''}`}
                  onClick={() => setModel(m.id)}
                >
                  <div className="welcome-model-name">
                    {m.name}
                    {m.tag && <span className="welcome-model-tag">{m.tag}</span>}
                  </div>
                  <div className="welcome-model-desc">{m.desc}</div>
                </div>
              ))}
            </div>
            {isV4Model && (
              <div style={{ width: '100%', maxWidth: 440, marginTop: 4, marginBottom: 12 }}>
                <div className="setting-label" style={{ marginBottom: 8 }}>Thinking Mode</div>
                <label className="setting-toggle" style={{ marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={thinkingEnabled}
                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                  />
                  <span>Show AI reasoning process</span>
                </label>
                <div className="setting-label" style={{ marginBottom: 8 }}>Reasoning Effort</div>
                <div className="reasoning-effort-row">
                  {(['high', 'max'] as const).map((level) => (
                    <button
                      key={level}
                      className={`effort-btn ${reasoningEffort === level ? 'active' : ''}`}
                      onClick={() => setReasoningEffort(level)}
                    >
                      <span className="effort-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                      <span className="effort-desc">
                        {level === 'high' ? 'Balanced' : 'Deepest'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="welcome-actions">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="welcome-next-btn" onClick={() => setStep(3)}>
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* Step 3: Work Directory */}
        {step === 3 && (
          <>
            <div className="welcome-step-badge">Step 3 of 3</div>
            <h2 className="welcome-step-title">Set Working Directory</h2>
            <p className="welcome-step-desc">
              Choose the directory where AI can read and write files. You can skip this and set it later.
            </p>
            <div className="welcome-input-row">
              <input
                type="text"
                className="welcome-input"
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                placeholder="Select a directory..."
              />
              <button className="setting-icon-btn" onClick={handleSelectDir}>
                <FolderOpen size={16} />
              </button>
            </div>
            <div className="welcome-actions">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="welcome-next-btn" onClick={handleFinish}>
                Start Working
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
