import { useSyncExternalStore } from 'react'
import { ipc } from '../lib/ipc'

// 全域圖示快取：exePath → data URL（null = 抽不到，用預設圖）
const cache = new Map<string, string | null>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function ensureLoaded(path: string) {
  if (cache.has(path) || pending.has(path)) return
  pending.add(path)
  ipc
    .extractIcon(path)
    .then((url) => cache.set(path, url))
    .catch(() => cache.set(path, null))
    .finally(() => {
      pending.delete(path)
      notify()
    })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 預設圖示：通用執行檔（視窗）樣式，非 emoji */
function FallbackIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" className="fill-zinc-700" />
      <rect x="3" y="4" width="18" height="4" rx="2" className="fill-zinc-600" />
      <circle cx="6" cy="6" r="0.8" className="fill-zinc-400" />
      <circle cx="8.4" cy="6" r="0.8" className="fill-zinc-400" />
      <rect x="7" y="11" width="10" height="1.6" rx="0.8" className="fill-zinc-500" />
      <rect x="7" y="14.5" width="6" height="1.6" rx="0.8" className="fill-zinc-500" />
    </svg>
  )
}

export function AppIcon({ exePath, size = 40 }: { exePath: string; size?: number }) {
  const url = useSyncExternalStore(
    subscribe,
    () => (cache.has(exePath) ? cache.get(exePath)! : undefined),
    () => undefined,
  )
  ensureLoaded(exePath)

  if (url) {
    return <img src={url} width={size} height={size} className="rounded" alt="" />
  }
  return <FallbackIcon size={size} />
}
