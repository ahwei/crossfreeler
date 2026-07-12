import { useState } from 'react'
import { open, ask, message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useT } from '../i18n'
import { useInstalledStore } from '../stores/installedStore'
import { ExePickerModal } from './ExePickerModal'
import { ShortcutModal } from './ShortcutModal'
import type { Bottle, InstalledProgram } from '../lib/types'

export function InstalledPanel({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const programs = useInstalledStore((s) => s.programs[bottle.id])
  const loading = useInstalledStore((s) => s.loading[bottle.id] ?? false)
  const refresh = useInstalledStore((s) => s.refresh)
  // 為哪個已安裝程式挑 exe（值 = 程式名稱；空字串 = 自由掃描）
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [shortcutInit, setShortcutInit] = useState<{ exePath: string; name?: string } | null>(null)

  const pickManual = async () => {
    const picked = await open({
      title: t.pickProgram,
      filters: [{ name: t.windowsPrograms, extensions: ['exe', 'bat'] }],
    })
    if (typeof picked === 'string') setShortcutInit({ exePath: picked })
  }

  // 首次切到此 tab 自動載入一次（之後靠 program-exited 事件自動刷新）
  if (programs === undefined && !loading) void refresh(bottle.id)

  const uninstall = async (p: InstalledProgram) => {
    const yes = await ask(t.confirmUninstall(p.name), { title: 'CrossFreeler', kind: 'warning' })
    if (!yes) return
    try {
      await ipc.uninstallProgram(bottle.id, p.key)
      await message(t.uninstallStarted, { title: 'CrossFreeler' })
    } catch (e) {
      await message(String(e), { kind: 'error' })
    }
  }

  return (
    <div className="p-4">
      <p className="mb-3 text-sm text-zinc-500">{t.installedIntro}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => setPickingFor('')}
        >
          {t.scanShortcut}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          onClick={() => void pickManual()}
        >
          {t.addShortcut}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
          disabled={loading}
          onClick={() => void refresh(bottle.id)}
        >
          {loading ? t.loading : t.refresh}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          onClick={() => void ipc.openUninstaller(bottle.id).catch((e) => message(String(e), { kind: 'error' }))}
        >
          {t.openUninstallerGui}
        </button>
      </div>

      {programs !== undefined && programs.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-600">{t.noPrograms}</p>
      )}

      {programs !== undefined && programs.length > 0 && (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {programs.map((p) => (
            <div key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 truncate text-sm text-zinc-200" title={p.key}>
                {p.name}
              </span>
              <button
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-indigo-300 hover:border-indigo-500"
                onClick={() => setPickingFor(p.name)}
              >
                {t.createShortcutBtn}
              </button>
              <button
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-red-400 hover:border-red-600"
                onClick={() => void uninstall(p)}
              >
                {t.uninstall}
              </button>
            </div>
          ))}
        </div>
      )}

      {pickingFor !== null && (
        <ExePickerModal
          bottleId={bottle.id}
          onPick={(exePath) => {
            setShortcutInit({ exePath, name: pickingFor || undefined })
            setPickingFor(null)
          }}
          onClose={() => setPickingFor(null)}
        />
      )}
      {shortcutInit && (
        <ShortcutModal bottleId={bottle.id} initial={shortcutInit} onClose={() => setShortcutInit(null)} />
      )}
    </div>
  )
}
