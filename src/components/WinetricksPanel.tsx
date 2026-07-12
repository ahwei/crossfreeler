import { useState } from 'react'
import { message } from '@tauri-apps/plugin-dialog'
import { ipc } from '../lib/ipc'
import { useEnvStore } from '../stores/envStore'
import type { Bottle } from '../lib/types'

const PRESET_VERBS: { verb: string; desc: string }[] = [
  { verb: 'corefonts', desc: '常用西文字型' },
  { verb: 'cjkfonts', desc: '中日韓字型（中文亂碼必裝）' },
  { verb: 'vcrun2015', desc: 'Visual C++ 2015' },
  { verb: 'vcrun2019', desc: 'Visual C++ 2019' },
  { verb: 'vcrun2022', desc: 'Visual C++ 2022（多數遊戲需要）' },
  { verb: 'dotnet48', desc: '.NET Framework 4.8' },
  { verb: 'd3dcompiler_47', desc: 'DirectX shader 編譯器（遊戲常用）' },
  { verb: 'xact', desc: 'XACT 音效（老遊戲）' },
  { verb: 'gdiplus', desc: 'GDI+ 繪圖' },
  { verb: 'msxml6', desc: 'MSXML 6' },
]

export function WinetricksPanel({ bottle }: { bottle: Bottle }) {
  const winetricks = useEnvStore((s) => s.status?.winetricks)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  if (!winetricks) {
    return (
      <div className="p-6 text-sm text-zinc-400">
        <p className="mb-2">尚未安裝 winetricks，無法使用元件安裝功能。終端機執行：</p>
        <code className="rounded bg-zinc-950 px-3 py-2 font-mono text-emerald-300">brew install winetricks</code>
        <p className="mt-2 text-zinc-600">安裝後回到環境頁按「重新偵測」。</p>
      </div>
    )
  }

  const install = async (verbs: string[]) => {
    if (verbs.length === 0) return
    setBusy(true)
    try {
      await ipc.runWinetricks(bottle.id, verbs)
      await message(`安裝完成：${verbs.join(', ')}`, { title: 'CrossFreeler' })
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
        {PRESET_VERBS.map(({ verb, desc }) => (
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
            <span className="truncate text-xs text-zinc-500">{desc}</span>
          </label>
        ))}
      </div>

      <button
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        disabled={busy || selected.size === 0}
        onClick={() => void install([...selected])}
      >
        {busy ? '安裝中…（過程可能需要數分鐘，見 Log 面板）' : `安裝所選元件（${selected.size}）`}
      </button>

      <div className="flex gap-2 border-t border-zinc-800 pt-4">
        <input
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600"
          placeholder="自訂 verb，例如 dxvk faudio（空白分隔）"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={busy}
        />
        <button
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
          disabled={busy || !custom.trim()}
          onClick={() => void install(custom.trim().split(/\s+/))}
        >
          執行
        </button>
      </div>
    </div>
  )
}
