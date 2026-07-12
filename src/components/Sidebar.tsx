import { useState } from 'react'
import { useBottleStore } from '../stores/bottleStore'
import { useEnvStore } from '../stores/envStore'
import { CreateBottleModal } from './CreateBottleModal'

export function Sidebar() {
  const { bottles, selectedId, select } = useBottleStore()
  const status = useEnvStore((s) => s.status)
  const [creating, setCreating] = useState(false)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="text-xl">🍷</span>
        <span className="font-bold text-zinc-100">CrossFreeler</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Bottles</p>
        {bottles.length === 0 && (
          <p className="px-2 py-3 text-sm text-zinc-600">還沒有 Bottle，點下方按鈕建立。</p>
        )}
        {bottles.map((b) => (
          <button
            key={b.id}
            className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
              b.id === selectedId ? 'bg-indigo-600/20 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
            onClick={() => select(b.id)}
          >
            <span className="truncate">{b.name}</span>
            <span className="ml-2 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {b.windowsVersion}
              {b.runtime === 'staging' ? ' ⚡' : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-zinc-800 p-3">
        <button
          className="mb-2 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => setCreating(true)}
        >
          ＋ 建立 Bottle
        </button>
        <p className="truncate px-1 text-[11px] text-zinc-600" title={status?.wine?.path}>
          {status?.wine ? status.wine.version : 'Wine 未偵測到'}
          {status?.staging ? ` / ${status.staging.version}` : ''}
        </p>
      </div>

      {creating && <CreateBottleModal onClose={() => setCreating(false)} />}
    </aside>
  )
}
