import { useState } from 'react'
import { open, ask, message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import { useRunningStore, runningKey } from '../stores/runningStore'
import { ShortcutModal } from './ShortcutModal'
import { ExePickerModal } from './ExePickerModal'
import { AppIcon } from './AppIcon'
import type { Bottle, Shortcut } from '../lib/types'
import { useT } from '../i18n'

export function ShortcutGrid({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const load = useBottleStore((s) => s.load)
  const running = useRunningStore((s) => s.running)
  const markStarted = useRunningStore((s) => s.markStarted)
  const [editing, setEditing] = useState<(Partial<Shortcut> & { exePath: string }) | null>(null)
  const [scanning, setScanning] = useState(false)

  const isRunning = (exePath: string) => runningKey(bottle.id, exePath) in running

  const runExe = async (exePath: string, args = '', name?: string) => {
    if (isRunning(exePath)) {
      const again = await ask(t.confirmLaunchAgain(name ?? exePath.split('/').pop() ?? ''), {
        title: 'CrossFreeler',
        kind: 'warning',
      })
      if (!again) return
    }
    try {
      const pid = await ipc.runProgram(bottle.id, exePath, args)
      markStarted(bottle.id, exePath, pid)
    } catch (e) {
      await message(String(e), { kind: 'error' })
    }
  }

  const pickExe = async () => {
    const defaultPath = await ipc.driveCPath(bottle.id).catch(() => undefined)
    return open({
      title: t.pickProgram,
      defaultPath,
      filters: [{ name: t.windowsPrograms, extensions: ['exe', 'msi', 'bat'] }],
    })
  }

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
          onClick={() => setScanning(true)}
        >
          {t.scanShortcut}
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
              className={`group cursor-pointer rounded-xl border p-4 ${
                isRunning(s.exePath)
                  ? 'border-emerald-600/60 bg-emerald-950/20'
                  : 'border-zinc-800 bg-zinc-900 hover:border-indigo-600/60'
              }`}
              onClick={() => void runExe(s.exePath, s.args, s.name)}
              title={s.exePath}
            >
              <div className="mb-1 flex items-center justify-between">
                <AppIcon exePath={s.exePath} size={40} />
                {isRunning(s.exePath) && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {t.runningBadge}
                  </span>
                )}
              </div>
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

      {scanning && (
        <ExePickerModal
          bottleId={bottle.id}
          onPick={(exePath) => {
            setEditing({ exePath })
            setScanning(false)
          }}
          onClose={() => setScanning(false)}
        />
      )}
      {editing && <ShortcutModal bottleId={bottle.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
