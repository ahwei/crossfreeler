import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { InstalledProgram } from '../lib/types'

interface InstalledState {
  programs: Record<string, InstalledProgram[]>
  loading: Record<string, boolean>
  error: string | null
  refresh: (bottleId: string) => Promise<void>
  /** 只在該 bottle 曾載入過清單時才重新整理（給 program-exited 事件用） */
  refreshIfLoaded: (bottleId: string) => void
}

export const useInstalledStore = create<InstalledState>((set, get) => ({
  programs: {},
  loading: {},
  error: null,
  refresh: async (bottleId) => {
    set((s) => ({ loading: { ...s.loading, [bottleId]: true }, error: null }))
    try {
      const list = await ipc.listPrograms(bottleId)
      set((s) => ({ programs: { ...s.programs, [bottleId]: list } }))
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set((s) => ({ loading: { ...s.loading, [bottleId]: false } }))
    }
  },
  refreshIfLoaded: (bottleId) => {
    if (bottleId in get().programs) void get().refresh(bottleId)
  },
}))
