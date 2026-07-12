import { useEnvStore } from './stores/envStore'
import { useSelectedBottle } from './stores/bottleStore'
import { Sidebar } from './components/Sidebar'
import { SetupGuide } from './components/SetupGuide'
import { BottleDetail } from './components/BottleDetail'
import { LogPanel } from './components/LogPanel'
import { useT } from './i18n'

function App() {
  const t = useT()
  const status = useEnvStore((s) => s.status)
  const selected = useSelectedBottle()

  if (!status) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        {t.detecting}
      </div>
    )
  }

  if (!status.wine) return <SetupGuide />

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <BottleDetail key={selected.id} bottle={selected} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-600">
            {t.selectOrCreate}
          </div>
        )}
        <LogPanel />
      </main>
    </div>
  )
}

export default App
