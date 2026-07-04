import { EventEmitter } from 'events'
import { uIOhook, UiohookKeyboardEvent } from 'uiohook-napi'

// ============================================================
// 键盘活动传感器 - 统计敲击频率，不记录内容
// 使用 uiohook-napi 全局钩子，仅统计频率，不记录按键内容
// ============================================================

export interface KeyboardData {
  activity: number    // 0-1 活跃度
  speed: number       // 键/秒
  isActive: boolean
}

export class KeyboardSensor extends EventEmitter {
  private keyCount: number = 0
  private lastReset: number = Date.now()
  private intervalId: NodeJS.Timeout | null = null
  private running: boolean = false
  private keyDownCount: number = 0

  start() {
    if (this.running) return
    this.running = true
    this.keyCount = 0
    this.keyDownCount = 0
    this.lastReset = Date.now()

    // 注册全局键盘钩子 - 只计数，不保存按键值
    uIOhook.on('keydown', this.handleKeyDown)

    // 每 500ms 计算一次频率并重置计数器
    this.intervalId = setInterval(() => {
      const elapsed = (Date.now() - this.lastReset) / 1000
      const speed = elapsed > 0 ? this.keyCount / elapsed : 0
      const activity = Math.min(speed / 15, 1) // 15键/秒视为满活跃

      this.emit('data', {
        activity,
        speed,
        isActive: this.keyCount > 0,
      })

      this.keyCount = 0
      this.lastReset = Date.now()
    }, 500)
  }

  /** uiohook 回调 - 只计数，不记录按键值 */
  private handleKeyDown = (_event: UiohookKeyboardEvent) => {
    if (this.running) {
      this.keyCount++
      this.keyDownCount++
    }
  }

  stop() {
    this.running = false
    uIOhook.removeListener('keydown', this.handleKeyDown)
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  getTotalKeyDowns(): number {
    return this.keyDownCount
  }
}
