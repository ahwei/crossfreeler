import { listen } from '@tauri-apps/api/event'
import { useEnvStore } from '../stores/envStore'
import { useBottleStore } from '../stores/bottleStore'
import { useLogStore } from '../stores/logStore'
import { useInstalledStore } from '../stores/installedStore'
import { useRunningStore } from '../stores/runningStore'
import type { LogLine } from './types'

/** App 啟動時呼叫一次：載入資料 + 訂閱後端事件（模組層級，不進 React lifecycle） */
export function bootstrap() {
  void useEnvStore.getState().detect()
  void useBottleStore.getState().load()
  void listen<LogLine>('bottle-log', (event) => {
    useLogStore.getState().append(event.payload)
  })
  // 程式結束 → 解除「執行中」狀態 + 自動重新整理該 bottle 的已安裝清單
  void listen<{ bottleId: string; exePath: string | null }>('program-exited', (event) => {
    const { bottleId, exePath } = event.payload
    if (exePath) useRunningStore.getState().markExited(bottleId, exePath)
    useInstalledStore.getState().refreshIfLoaded(bottleId)
  })
}
