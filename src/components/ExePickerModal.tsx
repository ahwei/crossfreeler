import { useState } from 'react'
import { open, message } from '@tauri-apps/plugin-dialog'
import { Modal } from './Modal'
import { ipc } from '../lib/ipc'
import { useT } from '../i18n'
import type { ExeEntry } from '../lib/types'

interface Props {
  bottleId: string
  onPick: (exePath: string) => void
  onClose: () => void
}

export function ExePickerModal({ bottleId, onPick, onClose }: Props) {
  const t = useT()
  const [exes, setExes] = useState<ExeEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setExes(await ipc.listExes(bottleId))
    } catch (e) {
      await message(String(e), { kind: 'error' })
      setExes([])
    } finally {
      setLoading(false)
    }
  }
  if (exes === null && !loading) void load()

  const manualPick = async () => {
    const defaultPath = await ipc.driveCPath(bottleId).catch(() => undefined)
    const picked = await open({
      title: t.pickProgram,
      defaultPath,
      filters: [{ name: t.windowsPrograms, extensions: ['exe', 'bat'] }],
    })
    if (typeof picked === 'string') onPick(picked)
  }

  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = (exes ?? []).filter((e) =>
    tokens.every((tk) => e.name.toLowerCase().includes(tk) || e.path.toLowerCase().includes(tk)),
  )

  return (
    <Modal title={t.pickExeTitle} onClose={onClose}>
      <div className="space-y-3">
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
          placeholder={t.searchExePlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {loading && <p className="py-6 text-center text-sm text-zinc-600">{t.loading}</p>}

        {!loading && exes !== null && filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-600">{t.noExesFound}</p>
        )}

        {filtered.length > 0 && (
          <div className="max-h-72 divide-y divide-zinc-800 overflow-y-auto rounded-lg border border-zinc-800">
            {filtered.slice(0, 100).map((e) => (
              <button
                key={e.path}
                className="block w-full px-3 py-2 text-left hover:bg-zinc-800"
                onClick={() => onPick(e.path)}
              >
                <p className="truncate text-sm text-zinc-100">{e.name}</p>
                <p className="truncate text-[11px] text-zinc-600">
                  {e.path.split('/drive_c/').pop()?.replace(/\//g, ' › ')}
                </p>
              </button>
            ))}
          </div>
        )}

        <button
          className="w-full rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          onClick={() => void manualPick()}
        >
          {t.manualPick}
        </button>
      </div>
    </Modal>
  )
}
