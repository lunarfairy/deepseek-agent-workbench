import { Minus, Square, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settings-store'

export function TitleBar() {
  const settings = useSettingsStore((s) => s.settings)

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <span className="titlebar-title">DeepSeek Agent Workbench</span>
        <span className="titlebar-model">{settings.model || 'deepseek-v4-flash'}</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" title="Minimize" onClick={() => window.api.windowMinimize()}>
          <Minus size={14} />
        </button>
        <button className="titlebar-btn" title="Maximize" onClick={() => window.api.windowMaximize()}>
          <Square size={12} />
        </button>
        <button className="titlebar-btn titlebar-btn-close" title="Close" onClick={() => window.api.windowClose()}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
