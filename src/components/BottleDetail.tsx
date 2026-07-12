import { useState } from 'react'
import { message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import { ShortcutGrid } from './ShortcutGrid'
import { InstalledPanel } from './InstalledPanel'
import { WinetricksPanel } from './WinetricksPanel'
import { BottleSettings } from './BottleSettings'
import type { Bottle } from '../lib/types'
import { useT } from '../i18n'

type Tab = 'installed' | 'apps' | 'tricks' | 'settings'

export function BottleDetail({ bottle }: { bottle: Bottle }) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('installed')
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(bottle.name)
  const load = useBottleStore((s) => s.load)

  const call = (fn: () => Promise<unknown>) => () =>
    void fn().catch((e) => message(String(e), { kind: 'error' }))

  const rename = async () => {
    if (newName.trim() && newName !== bottle.name) {
      try {
        await ipc.renameBottle(bottle.id, newName)
        await load()
      } catch (e) {
        await message(String(e), { kind: 'error' })
        setNewName(bottle.name)
      }
    }
    setRenaming(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        {renaming ? (
          <input
            className="rounded-lg border border-indigo-500 bg-zinc-950 px-2 py-1 text-lg font-semibold text-zinc-100"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => void rename()}
            onKeyDown={(e) => e.key === 'Enter' && void rename()}
          />
        ) : (
          <h1
            className="cursor-pointer text-lg font-semibold text-zinc-100 hover:text-indigo-300"
            title={t.clickToRename}
            onClick={() => {
              setNewName(bottle.name)
              setRenaming(true)
            }}
          >
            {bottle.name}
          </h1>
        )}
        <div className="ml-auto flex gap-1.5">
          <button
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            onClick={call(() => ipc.runWinecfg(bottle.id))}
          >
            winecfg
          </button>
          <button
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            onClick={call(() => ipc.openDriveC(bottle.id))}
          >
            {t.openDriveC}
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-zinc-800 px-4">
        {(
          [
            { key: 'installed', label: t.tabInstalled },
            { key: 'apps', label: t.tabApps },
            { key: 'tricks', label: t.tabTricks },
            { key: 'settings', label: t.tabSettings },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            className={`px-4 py-2 text-sm ${
              tab === item.key
                ? 'border-b-2 border-indigo-500 font-medium text-indigo-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'apps' && <ShortcutGrid bottle={bottle} />}
        {tab === 'installed' && <InstalledPanel key={bottle.id} bottle={bottle} />}
        {tab === 'tricks' && <WinetricksPanel bottle={bottle} />}
        {tab === 'settings' && <BottleSettings key={bottle.id} bottle={bottle} />}
      </div>
    </div>
  )
}
