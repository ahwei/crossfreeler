import { useLogStore } from '../stores/logStore'
import { useBottleStore } from '../stores/bottleStore'
import { CREATE_CHANNEL } from '../lib/types'
import { useT } from '../i18n'

export function LogPanel() {
  const t = useT()
  const { logs, panelOpen, activeTab, setPanelOpen, setActiveTab, clear } = useLogStore()
  const bottles = useBottleStore((s) => s.bottles)

  const tabIds = Object.keys(logs).filter((id) => logs[id].length > 0)
  const tabName = (id: string) =>
    id === CREATE_CHANNEL ? t.createChannelName : (bottles.find((b) => b.id === id)?.name ?? t.deletedBottleName)
  const active = activeTab && tabIds.includes(activeTab) ? activeTab : tabIds[0]
  const lines = active ? logs[active] : []

  return (
    <div className="border-t border-zinc-800 bg-zinc-900">
      <button
        className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <span>
          {t.log}
          {tabIds.length > 0 ? `（${tabIds.length}）` : ''}
        </span>
        <span>{panelOpen ? t.collapse : t.expand}</span>
      </button>

      {panelOpen && (
        <div className="h-48">
          <div className="flex items-center gap-1 border-b border-zinc-800 px-2">
            {tabIds.map((id) => (
              <button
                key={id}
                className={`px-3 py-1 text-xs ${
                  id === active ? 'border-b-2 border-indigo-500 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                onClick={() => setActiveTab(id)}
              >
                {tabName(id)}
              </button>
            ))}
            <div className="ml-auto flex gap-2 py-1">
              {active && (
                <>
                  <button
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700"
                    onClick={() => navigator.clipboard.writeText(lines.map((l) => l.line).join('\n'))}
                  >
                    {t.copyAll}
                  </button>
                  <button
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700"
                    onClick={() => clear(active)}
                  >
                    {t.clear}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="h-[calc(100%-28px)] overflow-y-auto px-3 py-1 font-mono text-[11px] leading-relaxed">
            {lines.length === 0 && <p className="py-4 text-center text-zinc-700">{t.noOutput}</p>}
            {lines.map((l, i) => (
              <p key={i} className={l.stream === 'stderr' ? 'text-amber-200/50' : 'text-zinc-400'}>
                {l.line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
