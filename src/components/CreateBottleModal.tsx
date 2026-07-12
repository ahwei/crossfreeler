import { useState } from 'react'
import { Modal } from './Modal'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import { useEnvStore } from '../stores/envStore'
import { useLogStore } from '../stores/logStore'
import { CREATE_CHANNEL, type LogLine, type WindowsVersion } from '../lib/types'
import { useT } from '../i18n'

type Template = 'app' | 'game'

const GAME_ENV: Record<string, string> = { WINEESYNC: '1', WINEDEBUG: '-all' }
// Zustand selector 必須回傳穩定 reference，否則會無限重渲染
const NO_LOGS: LogLine[] = []

export function CreateBottleModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [version, setVersion] = useState<WindowsVersion>('win10')
  const [template, setTemplate] = useState<Template>('game')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasStaging = useEnvStore((s) => !!s.status?.staging)
  const createLogs = useLogStore((s) => s.logs[CREATE_CHANNEL] ?? NO_LOGS)
  const load = useBottleStore((s) => s.load)
  const select = useBottleStore((s) => s.select)

  const submit = async () => {
    setError(null)
    setBusy(true)
    useLogStore.getState().clear(CREATE_CHANNEL)
    try {
      const runtime = template === 'game' && hasStaging ? 'staging' : 'stable'
      const envVars = template === 'game' ? GAME_ENV : {}
      const bottle = await ipc.createBottle(name, version, runtime, envVars)
      await load()
      select(bottle.id)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t.createTitle} onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">{t.name}</label>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-600"
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">{t.template}</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: 'game', label: t.templateGame, desc: hasStaging ? t.gameStagingDesc : t.gameNoStagingDesc },
                { key: 'app', label: t.templateApp, desc: t.stableDesc },
              ] as const
            ).map((tp) => (
              <button
                key={tp.key}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  template === tp.key
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
                onClick={() => setTemplate(tp.key)}
                disabled={busy}
              >
                <div>{tp.label}</div>
                <div className="text-xs text-zinc-500">{tp.desc}</div>
              </button>
            ))}
          </div>
          {template === 'game' && <p className="mt-1.5 text-xs text-amber-500/80">{t.antiCheatWarning}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">{t.windowsVersion}</label>
          <select
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={version}
            onChange={(e) => setVersion(e.target.value as WindowsVersion)}
            disabled={busy}
          >
            <option value="win11">Windows 11</option>
            <option value="win10">{t.win10Recommended}</option>
            <option value="win7">Windows 7</option>
          </select>
        </div>

        {busy && (
          <div className="max-h-32 overflow-y-auto rounded-lg bg-zinc-950 p-2 font-mono text-xs text-zinc-500">
            <p className="text-indigo-300">{t.initializing}</p>
            {createLogs.slice(-8).map((l, i) => (
              <p key={i} className={l.stream === 'stderr' ? 'text-zinc-600' : ''}>
                {l.line}
              </p>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          disabled={busy || !name.trim()}
          onClick={() => void submit()}
        >
          {busy ? t.creatingBtn : t.create}
        </button>
      </div>
    </Modal>
  )
}
