import { useState } from 'react'
import { open, ask, message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import { ShortcutModal } from './ShortcutModal'
import type { Bottle, Shortcut } from '../lib/types'
import { useT } from '../i18n'

export function ShortcutGrid({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const load = useBottleStore((s) => s.load)
  const [editing, setEditing] = useState<(Partial<Shortcut> & { exePath: string }) | null>(null)

  const runExe = async (exePath: string, args = '') => {
    try {
      await ipc.runProgram(bottle.id, exePath, args)
    } catch (e) {
      await message(String(e), { kind: 'error' })
    }
  }

  const pickExe = () =>
    open({
      title: t.pickProgram,
      filters: [{ name: t.windowsPrograms, extensions: ['exe', 'msi', 'bat'] }],
    })

  const pickAndRun = async () => {
    const picked = await pickExe()
    if (typeof picked !== 'string') return
    await runExe(picked)
    const save = await ask(t.saveAsShortcut, { title: 'CrossFreeler' })
    if (save) setEditing({ exePath: picked })
  }

  const pickAndAdd = async () => {
    const picked = await pickExe()
    if (typeof picked !== 'string') return
    setEditing({ exePath: picked })
  }

  const remove = async (s: Shortcut) => {
    const yes = await ask(t.confirmDeleteShortcut(s.name), { title: 'CrossFreeler', kind: 'warning' })
    if (!yes) return
    await ipc.removeShortcut(bottle.id, s.id)
    await load()
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => void pickAndRun()}
        >
          {t.runProgram}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          onClick={() => void pickAndAdd()}
        >
          {t.addShortcut}
        </button>
      </div>

      {bottle.shortcuts.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">{t.noShortcuts}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {bottle.shortcuts.map((s) => (
            <div
              key={s.id}
              className="group cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-indigo-600/60"
              onClick={() => void runExe(s.exePath, s.args)}
              title={s.exePath}
            >
              <div className="mb-1 text-2xl">🎮</div>
              <p className="truncate font-medium text-zinc-100">{s.name}</p>
              <p className="truncate text-xs text-zinc-600">{s.exePath.split('/').pop()}</p>
              <div className="mt-2 hidden gap-2 group-hover:flex">
                <button
                  className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(s)
                  }}
                >
                  {t.edit}
                </button>
                <button
                  className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-red-400 hover:bg-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    void remove(s)
                  }}
                >
                  {t.del}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <ShortcutModal bottleId={bottle.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
