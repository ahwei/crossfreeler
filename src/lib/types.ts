export type WindowsVersion = 'win11' | 'win10' | 'win7'
export type RuntimeChannel = 'stable' | 'staging'

export interface Shortcut {
  id: string
  name: string
  exePath: string
  args: string
}

export interface Bottle {
  id: string
  name: string
  createdAt: string
  windowsVersion: WindowsVersion
  runtime: RuntimeChannel
  envVars: Record<string, string>
  shortcuts: Shortcut[]
}

export interface AppConfig {
  version: number
  winePath: string | null
  bottles: Bottle[]
}

export interface WineInfo {
  path: string
  version: string
}

export interface EnvStatus {
  rosetta: boolean
  wine: WineInfo | null
  staging: WineInfo | null
  winetricks: string | null
}

export interface InstalledProgram {
  key: string
  name: string
}

export interface LogLine {
  bottleId: string
  line: string
  stream: 'stdout' | 'stderr'
}

/** 建立 bottle 過程的 log 頻道 id（與後端 CREATE_CHANNEL 一致） */
export const CREATE_CHANNEL = '__create__'
