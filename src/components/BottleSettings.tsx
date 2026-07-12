import { useState } from 'react'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import type { Bottle, WindowsVersion } from '../lib/types'
import { useT } from '../i18n'

export function BottleSettings({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const load = useBottleStore((s) => s.load)
  const select = useBottleStore((s) => s.select)
  const [rows, setRows] = useState<[string, string][]>(Object.entries(bottle.envVars))
  const [busy, setBusy] = useState(false)

  const ENV_PRESETS: { label: string; key: string; value: string }[] = [
    { label: t.presetEsync, key: 'WINEESYNC', value: '1' },
    { label: t.presetNoDebug, key: 'WINEDEBUG', value: '-all' },
    { label: t.presetMtlHud, key: 'MTL_HUD_ENABLED', value: '1' },
    { label: t.presetBig5, key: 'LC_ALL', value: 'zh_TW.Big5' },
    { label: t.presetLocale, key: 'LC_ALL', value: 'zh_TW.UTF-8' },
  ]

  const saveEnv = async () => {
    const env: Record<string, string> = {}
    for (const [k, v] of rows) {
      if (k.trim()) env[k.trim()] = v
    }
    try {
      await ipc.updateBottleEnv(bottle.id, env)
      await load()
      await message(t.envSaved, { title: 'CrossFreeler' })
    } catch (e) {
      await message(String(e), { kind: 'error' })
    }
  }

  const changeVersion = async (version: WindowsVersion) => {
    setBusy(true)
    try {
      await ipc.setWindowsVersion(bottle.id, version)
      await load()
    } catch (e) {
      await message(String(e), { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const removeBottle = async () => {
    const yes = await ask(t.confirmDeleteBottle(bottle.name), { title: 'CrossFreeler', kind: 'warning' })
    if (!yes) return
    try {
      await ipc.deleteBottle(bottle.id)
      select(null)
      await load()
    } catch (e) {
      await message(String(e), { kind: 'error' })
    }
  }

  return (
    <div className="max-w-2xl space-y-6 p-4">
      <section>
        <h3 className="mb-2 font-medium text-zinc-200">{t.windowsVersion}</h3>
        <select
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          value={bottle.windowsVersion}
          disabled={busy}
          onChange={(e) => void changeVersion(e.target.value as WindowsVersion)}
        >
          <option value="win11">Windows 11</option>
          <option value="win10">Windows 10</option>
          <option value="win7">Windows 7</option>
        </select>
        <span className="ml-3 text-sm text-zinc-500">
          {t.runtimeLabel}
          {bottle.runtime === 'staging' ? t.runtimeStaging : t.runtimeStable}
        </span>
      </section>

      <section>
        <h3 className="mb-2 font-medium text-zinc-200">{t.envVars}</h3>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ENV_PRESETS.map((p) => (
            <button
              key={p.key}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-300"
              onClick={() => {
                if (rows.some(([k]) => k === p.key)) return
                setRows([...rows, [p.key, p.value]])
              }}
            >
              ＋ {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {rows.map(([k, v], i) => (
            <div key={i} className="flex gap-1.5">
              <input
                className="w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                placeholder="KEY"
                value={k}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
              />
              <input
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                placeholder="value"
                value={v}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
              />
              <button
                className="px-2 text-zinc-500 hover:text-red-400"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
            onClick={() => setRows([...rows, ['', '']])}
          >
            {t.addRow}
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => void saveEnv()}
          >
            {t.save}
          </button>
        </div>
      </section>

      <section className="border-t border-zinc-800 pt-4">
        <h3 className="mb-2 font-medium text-red-400">{t.dangerZone}</h3>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-amber-400 hover:border-amber-600"
            onClick={() => void ipc.killBottle(bottle.id).catch((e) => message(String(e), { kind: 'error' }))}
          >
            {t.killBottle}
          </button>
          <button
            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:border-red-600"
            onClick={() => void removeBottle()}
          >
            {t.deleteBottle}
          </button>
        </div>
      </section>
    </div>
  )
}
