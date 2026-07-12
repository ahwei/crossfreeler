import { useState } from 'react'
import { useEnvStore } from '../stores/envStore'
import { ipc } from '../lib/ipc'
import { message } from '@tauri-apps/plugin-dialog'
import { useT } from '../i18n'

function CommandBox({ command }: { command: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300">
      <code className="flex-1 select-all overflow-x-auto whitespace-nowrap">{command}</code>
      <button
        className="shrink-0 rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
        onClick={async () => {
          await navigator.clipboard.writeText(command)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  )
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{ok ? '✓' : '✗'}</span>
      <span className="text-zinc-200">{label}</span>
      {detail && <span className="truncate text-sm text-zinc-500">{detail}</span>}
    </div>
  )
}

export function SetupGuide() {
  const t = useT()
  const { status, detecting, detect } = useEnvStore()
  const [manualPath, setManualPath] = useState('')
  if (!status) return null

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-[560px] rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="mb-1 text-2xl font-bold text-zinc-100">{t.welcome}</h1>
        <p className="mb-6 text-sm text-zinc-400">{t.setupIntro}</p>

        <div className="mb-6 rounded-lg border border-zinc-800 p-4">
          <StatusRow ok={status.rosetta} label="Rosetta 2" />
          <StatusRow ok={!!status.wine} label="Wine" detail={status.wine?.version} />
          <StatusRow ok={!!status.winetricks} label={t.winetricksOptional} detail={status.winetricks ?? undefined} />
        </div>

        {!status.rosetta && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-zinc-300">{t.installRosettaStep}</p>
            <CommandBox command="softwareupdate --install-rosetta --agree-to-license" />
          </div>
        )}

        {!status.wine && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-zinc-300">{t.installWineStep}</p>
            <CommandBox command="brew install --cask wine-stable" />
            <p className="mt-3 mb-2 text-sm text-zinc-300">{t.orManualPath}</p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
                placeholder="/path/to/wine"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
              />
              <button
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-600"
                onClick={async () => {
                  try {
                    await ipc.setWinePath(manualPath.trim() || null)
                    await detect()
                  } catch (e) {
                    await message(String(e), { kind: 'error' })
                  }
                }}
              >
                {t.save}
              </button>
            </div>
          </div>
        )}

        <button
          className="mt-2 w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          disabled={detecting}
          onClick={() => void detect()}
        >
          {detecting ? t.detectingBtn : t.redetect}
        </button>
      </div>
    </div>
  )
}
