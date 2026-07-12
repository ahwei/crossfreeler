import { useState } from 'react'
import { Modal } from './Modal'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import { useEnvStore } from '../stores/envStore'
import { useLogStore } from '../stores/logStore'
import { CREATE_CHANNEL, type WindowsVersion } from '../lib/types'

type Template = 'app' | 'game'

const GAME_ENV: Record<string, string> = { WINEESYNC: '1', WINEDEBUG: '-all' }

export function CreateBottleModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [version, setVersion] = useState<WindowsVersion>('win10')
  const [template, setTemplate] = useState<Template>('game')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasStaging = useEnvStore((s) => !!s.status?.staging)
  const createLogs = useLogStore((s) => s.logs[CREATE_CHANNEL] ?? [])
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
    <Modal title="建立 Bottle" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">名稱</label>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-600"
            placeholder="例如：星露谷物語"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">範本</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: 'game', label: '🎮 遊戲', desc: hasStaging ? 'staging + esync' : 'esync（無 staging，退用 stable）' },
                { key: 'app', label: '🧰 一般軟體', desc: 'stable' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  template === t.key
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
                onClick={() => setTemplate(t.key)}
                disabled={busy}
              >
                <div>{t.label}</div>
                <div className="text-xs text-zinc-500">{t.desc}</div>
              </button>
            ))}
          </div>
          {template === 'game' && (
            <p className="mt-1.5 text-xs text-amber-500/80">
              注意：使用 kernel anti-cheat（EAC / BattlEye）的線上遊戲無法在 Wine 上執行。
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">Windows 版本</label>
          <select
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={version}
            onChange={(e) => setVersion(e.target.value as WindowsVersion)}
            disabled={busy}
          >
            <option value="win11">Windows 11</option>
            <option value="win10">Windows 10（建議）</option>
            <option value="win7">Windows 7</option>
          </select>
        </div>

        {busy && (
          <div className="max-h-32 overflow-y-auto rounded-lg bg-zinc-950 p-2 font-mono text-xs text-zinc-500">
            <p className="text-indigo-300">初始化中，約需 30 秒～1 分鐘…</p>
            {createLogs.slice(-8).map((l, i) => (
              <p key={i} className={l.stream === 'stderr' ? 'text-zinc-600' : ''}>{l.line}</p>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          disabled={busy || !name.trim()}
          onClick={() => void submit()}
        >
          {busy ? '建立中…' : '建立'}
        </button>
      </div>
    </Modal>
  )
}
