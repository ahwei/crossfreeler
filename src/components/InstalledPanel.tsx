import { useState } from 'react'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useT } from '../i18n'
import type { Bottle, InstalledProgram } from '../lib/types'

export function InstalledPanel({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const [programs, setPrograms] = useState<InstalledProgram[] | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      setPrograms(await ipc.listPrograms(bottle.id))
    } catch (e) {
      await message(String(e), { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // 首次切到此 tab 自動載入一次（render 期間觸發、以 state 防重入）
  if (programs === null && !loading) void refresh()

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
      <div className="mb-4 flex gap-2">
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
          disabled={loading}
          onClick={() => void refresh()}
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

      {programs !== null && programs.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-600">{t.noPrograms}</p>
      )}

      {programs !== null && programs.length > 0 && (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {programs.map((p) => (
            <div key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 truncate text-sm text-zinc-200" title={p.key}>
                {p.name}
              </span>
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
    </div>
  )
}
