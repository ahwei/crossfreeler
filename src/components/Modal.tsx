import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ title, children, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[480px] max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <button className="text-zinc-400 hover:text-zinc-100" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
