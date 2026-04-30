export interface ModelOption {
  id: string
  name: string
  description: string
  tag?: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'deepseek-v4-flash',
    name: 'V4 Flash',
    description: 'Fast & capable, great for most tasks',
    tag: 'Recommended'
  },
  {
    id: 'deepseek-v4-pro',
    name: 'V4 Pro',
    description: 'Most powerful, flagship model',
    tag: 'Pro'
  },
  {
    id: 'deepseek-chat',
    name: 'Chat V3',
    description: 'General-purpose, fast & versatile',
    tag: 'Legacy'
  },
  {
    id: 'deepseek-reasoner',
    name: 'Reasoner R1',
    description: 'Deep reasoning for complex tasks',
    tag: 'Legacy'
  }
]

const KNOWN_MODEL_IDS = new Set(MODEL_OPTIONS.map((model) => model.id))

export function isKnownModel(model: string): boolean {
  return KNOWN_MODEL_IDS.has(model)
}

export function supportsThinkingControls(model: string): boolean {
  return model.startsWith('deepseek-v4-') || model === 'deepseek-chat' || model === 'deepseek-reasoner'
}
