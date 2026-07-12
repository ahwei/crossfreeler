import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { EnvStatus } from '../lib/types'

interface EnvState {
  status: EnvStatus | null
  detecting: boolean
  detect: () => Promise<void>
}

export const useEnvStore = create<EnvState>((set) => ({
  status: null,
  detecting: false,
  detect: async () => {
    set({ detecting: true })
    try {
      const status = await ipc.detectEnvironment()
      set({ status })
    } finally {
      set({ detecting: false })
    }
  },
}))
