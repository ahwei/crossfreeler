import { useState } from 'react'
import { message } from '@tauri-apps/plugin-dialog'
import { Modal } from './Modal'
import { ipc } from '../lib/ipc'
import { useBottleStore } from '../stores/bottleStore'
import { useT } from '../i18n'
import type { ExternalBottle } from '../lib/types'

export function ImportBottleModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [found, setFound] = useState<ExternalBottle[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const load = useBottleStore((s) => s.load)
  const select = useBottleStore((s) => s.select)
  const bottles = useBottleStore((s) => s.bottles)
  // 在 render 中衍生即可；selector 內建立新物件會造成無限重渲染
  const imported = new Set(bottles.map((b) => b.prefixPath).filter(Boolean))

  const scan = async () => {
    setLoading(true)
    try {
      setFound(await ipc.discoverExternalBottles())
    } catch (e) {
      await message(String(e), { kind: 'error' })
      setFound([])
    } finally {
      setLoading(false)
    }
  }
  if (found === null && !loading) void scan()

  const doImport = async (b: ExternalBottle) => {
    setImporting(b.prefixPath)
    try {
      const bottle = await ipc.importBottle(b.name, b.prefixPath)
      await load()
      select(bottle.id)
      onClose()
    } catch (e) {
      await message(String(e), { kind: 'error' })
    } finally {
      setImporting(null)
    }
  }

  return (
    <Modal title={t.importTitle} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">{t.importHint}</p>
        {loading && <p className="py-6 text-center text-sm text-zinc-600">{t.loading}</p>}
        {found !== null && found.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-600">{t.noExternalBottles}</p>
        )}
        {found !== null && found.length > 0 && (
          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {found.map((b) => {
              const already = imported.has(b.prefixPath)
              return (
                <div key={b.prefixPath} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                    {b.source}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-100">{b.name}</p>
                    <p className="truncate text-[11px] text-zinc-600">{b.prefixPath}</p>
                  </div>
                  <button
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                    disabled={already || importing !== null}
                    onClick={() => void doImport(b)}
                  >
                    {already ? t.alreadyImported : importing === b.prefixPath ? t.loading : t.importBtn}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
