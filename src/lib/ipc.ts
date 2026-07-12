import { invoke } from '@tauri-apps/api/core'
import type {
  AppConfig,
  Bottle,
  DisplaySettings,
  EnvStatus,
  ExeEntry,
  ExternalBottle,
  InstalledProgram,
  Shortcut,
  WindowsVersion,
  RuntimeChannel,
} from './types'

export const ipc = {
  detectEnvironment: () => invoke<EnvStatus>('detect_environment'),
  setWinePath: (path: string | null) => invoke<void>('set_wine_path', { path }),

  loadConfig: () => invoke<AppConfig>('load_config'),

  createBottle: (name: string, windowsVersion: WindowsVersion, runtime: RuntimeChannel, envVars: Record<string, string>) =>
    invoke<Bottle>('create_bottle', { name, windowsVersion, runtime, envVars }),
  renameBottle: (id: string, name: string) => invoke<void>('rename_bottle', { id, name }),
  deleteBottle: (id: string) => invoke<void>('delete_bottle', { id }),
  openDriveC: (id: string) => invoke<void>('open_drive_c', { id }),
  runWinecfg: (id: string) => invoke<void>('run_winecfg', { id }),
  killBottle: (id: string) => invoke<void>('kill_bottle', { id }),
  updateBottleEnv: (id: string, env: Record<string, string>) => invoke<void>('update_bottle_env', { id, env }),
  setRuntime: (id: string, runtime: RuntimeChannel) => invoke<void>('set_runtime', { id, runtime }),
  setWindowsVersion: (id: string, version: WindowsVersion) => invoke<void>('set_windows_version', { id, version }),

  runProgram: (bottleId: string, exePath: string, args = '', name?: string) =>
    invoke<number>('run_program', { bottleId, exePath, args, name }),
  runWinetricks: (bottleId: string, verbs: string[]) => invoke<void>('run_winetricks', { bottleId, verbs }),

  listPrograms: (bottleId: string) => invoke<InstalledProgram[]>('list_programs', { bottleId }),
  listExes: (bottleId: string) => invoke<ExeEntry[]>('list_exes', { bottleId }),
  driveCPath: (bottleId: string) => invoke<string>('drive_c_path', { bottleId }),
  discoverExternalBottles: () => invoke<ExternalBottle[]>('discover_external_bottles'),
  importBottle: (name: string, prefixPath: string) => invoke<Bottle>('import_bottle', { name, prefixPath }),
  installFonts: (bottleId: string) => invoke<void>('install_fonts', { bottleId }),
  setDisplay: (bottleId: string, display: DisplaySettings) => invoke<void>('set_display', { bottleId, display }),
  extractIcon: (path: string) => invoke<string | null>('extract_icon', { path }),
  uninstallProgram: (bottleId: string, key: string) => invoke<void>('uninstall_program', { bottleId, key }),
  openUninstaller: (bottleId: string) => invoke<void>('open_uninstaller', { bottleId }),

  addShortcut: (bottleId: string, shortcut: { name: string; exePath: string; args: string }) =>
    invoke<Shortcut>('add_shortcut', { bottleId, shortcut }),
  updateShortcut: (bottleId: string, shortcut: Shortcut) => invoke<void>('update_shortcut', { bottleId, shortcut }),
  removeShortcut: (bottleId: string, shortcutId: string) => invoke<void>('remove_shortcut', { bottleId, shortcutId }),
}
