import { create } from 'zustand'
import type { LogLine } from '../lib/types'

const MAX_LINES = 2000

interface LogState {
  logs: Record<string, LogLine[]>
  panelOpen: boolean
  activeTab: string | null
  append: (line: LogLine) => void
  clear: (bottleId: string) => void
  setPanelOpen: (open: boolean) => void
  setActiveTab: (bottleId: string) => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: {},
  panelOpen: false,
  activeTab: null,
  append: (line) =>
    set((s) => {
      const existing = s.logs[line.bottleId] ?? []
      const next = existing.length >= MAX_LINES ? [...existing.slice(-MAX_LINES + 1), line] : [...existing, line]
      return {
        logs: { ...s.logs, [line.bottleId]: next },
        activeTab: s.activeTab ?? line.bottleId,
      }
    }),
  clear: (bottleId) =>
    set((s) => ({ logs: { ...s.logs, [bottleId]: [] } })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setActiveTab: (bottleId) => set({ activeTab: bottleId }),
}))
