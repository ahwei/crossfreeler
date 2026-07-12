import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { Bottle } from '../lib/types'

interface BottleState {
  bottles: Bottle[]
  winePath: string | null
  selectedId: string | null
  load: () => Promise<void>
  select: (id: string | null) => void
}

export const useBottleStore = create<BottleState>((set, get) => ({
  bottles: [],
  winePath: null,
  selectedId: null,
  load: async () => {
    const config = await ipc.loadConfig()
    const { selectedId } = get()
    const stillExists = config.bottles.some((b) => b.id === selectedId)
    set({
      bottles: config.bottles,
      winePath: config.winePath,
      selectedId: stillExists ? selectedId : (config.bottles[0]?.id ?? null),
    })
  },
  select: (id) => set({ selectedId: id }),
}))

export const useSelectedBottle = () =>
  useBottleStore((s) => s.bottles.find((b) => b.id === s.selectedId) ?? null)
