import { useState } from 'react'
import { message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useEnvStore } from '../stores/envStore'
import type { Bottle } from '../lib/types'
import { useT } from '../i18n'

const PRESET_VERBS = [
  'corefonts',
  'cjkfonts',
  'vcrun2015',
  'vcrun2019',
  'vcrun2022',
  'dotnet48',
  'd3dcompiler_47',
  'xact',
  'gdiplus',
  'msxml6',
]

export function WinetricksPanel({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const winetricks = useEnvStore((s) => s.status?.winetricks)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  if (!winetricks) {
    return (
      <div className="p-6 text-sm text-zinc-400">
        <p className="mb-2">{t.winetricksMissing}</p>
        <code className="rounded bg-zinc-950 px-3 py-2 font-mono text-emerald-300">brew install winetricks</code>
        <p className="mt-2 text-zinc-600">{t.winetricksAfterInstall}</p>
      </div>
    )
  }

  const install = async (verbs: string[]) => {
    if (verbs.length === 0) return
    setBusy(true)
    try {
      await ipc.runWinetricks(bottle.id, verbs)
      await message(t.installDone(verbs.join(', ')), { title: 'CrossFreeler' })
      setSelected(new Set())
    } catch (e) {
      await message(String(e), { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-1.5">
        {PRESET_VERBS.map((verb) => (
          <label
            key={verb}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              selected.has(verb) ? 'border-indigo-500 bg-indigo-600/10' : 'border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(verb)}
              disabled={busy}
              onChange={(e) => {
                const next = new Set(selected)
                if (e.target.checked) next.add(verb)
                else next.delete(verb)
                setSelected(next)
              }}
            />
            <span className="font-mono text-zinc-200">{verb}</span>
            <span className="truncate text-xs text-zinc-500">{t.verbDesc[verb]}</span>
          </label>
        ))}
      </div>

      <button
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        disabled={busy || selected.size === 0}
        onClick={() => void install([...selected])}
      >
        {busy ? t.installingHint : t.installSelected(selected.size)}
      </button>

      <div className="flex gap-2 border-t border-zinc-800 pt-4">
        <input
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600"
          placeholder={t.customVerbPlaceholder}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={busy}
        />
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
          disabled={busy || !custom.trim()}
          onClick={() => void install(custom.trim().split(/\s+/))}
        >
          {t.run}
        </button>
      </div>
    </div>
  )
}
