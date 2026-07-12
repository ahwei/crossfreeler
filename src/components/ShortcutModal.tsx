import { useState } from 'react'
import { Modal } from './Modal'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import type { Shortcut } from '../lib/types'
import { useT } from '../i18n'

interface Props {
  bottleId: string
  /** 帶 id = 編輯既有捷徑；不帶 = 新增 */
  initial: Partial<Shortcut> & { exePath: string }
  onClose: () => void
}

export function ShortcutModal({ bottleId, initial, onClose }: Props) {
  const t = useT()
  const defaultName = initial.name ?? initial.exePath.split('/').pop()?.replace(/\.(exe|msi|bat)$/i, '') ?? ''
  const [name, setName] = useState(defaultName)
  const [args, setArgs] = useState(initial.args ?? '')
  const [error, setError] = useState<string | null>(null)
  const load = useBottleStore((s) => s.load)

  const submit = async () => {
    try {
      if (initial.id) {
        await ipc.updateShortcut(bottleId, { id: initial.id, name, exePath: initial.exePath, args })
      } else {
        await ipc.addShortcut(bottleId, { name, exePath: initial.exePath, args })
      }
      await load()
      onClose()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <Modal title={initial.id ? t.editShortcut : t.newShortcut} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">{t.name}</label>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">{t.programPath}</label>
          <p className="break-all rounded-lg bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-500">{initial.exePath}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">{t.launchArgs}</label>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          disabled={!name.trim()}
          onClick={() => void submit()}
        >
          {t.save}
        </button>
      </div>
    </Modal>
  )
}
