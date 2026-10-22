import { create } from 'zustand'

export type Screen = 'home' | 'clips' | 'edit'

interface AppState {
  screen: Screen
  file: File | null
  advanced: boolean
  go: (s: Screen) => void
  setFile: (f: File | null) => void
  toggleAdvanced: () => void
}

export const useApp = create<AppState>((set) => ({
  screen: 'home',
  file: null,
  advanced: false,
  go: (screen) => set({ screen }),
  setFile: (file) => set({ file }),
  toggleAdvanced: () => set((s) => ({ advanced: !s.advanced })),
}))
