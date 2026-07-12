import { listen } from '@tauri-apps/api/event'
import { useEnvStore } from '../stores/envStore'
import { useBottleStore } from '../stores/bottleStore'
import { useLogStore } from '../stores/logStore'
import type { LogLine } from './types'

/** App 啟動時呼叫一次：載入資料 + 訂閱後端事件（模組層級，不進 React lifecycle） */
export function bootstrap() {
  void useEnvStore.getState().detect()
  void useBottleStore.getState().load()
  void listen<LogLine>('bottle-log', (event) => {
    useLogStore.getState().append(event.payload)
  })
}
