import { listen } from '@tauri-apps/api/event'
import { useEnvStore } from '../stores/envStore'
import { useBottleStore } from '../stores/bottleStore'
import { useLogStore } from '../stores/logStore'
import { useInstalledStore } from '../stores/installedStore'
import type { LogLine } from './types'

/** App 啟動時呼叫一次：載入資料 + 訂閱後端事件（模組層級，不進 React lifecycle） */
export function bootstrap() {
  void useEnvStore.getState().detect()
  void useBottleStore.getState().load()
  void listen<LogLine>('bottle-log', (event) => {
    useLogStore.getState().append(event.payload)
  })
  // 安裝程式／解除安裝程式跑完 → 自動重新整理該 bottle 的已安裝清單
  void listen<{ bottleId: string }>('program-exited', (event) => {
    useInstalledStore.getState().refreshIfLoaded(event.payload.bottleId)
  })
}
