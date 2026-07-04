import { EventEmitter } from 'events'
import activeWindow from 'active-win'

// ============================================================
// 前台窗口传感器 - 检测当前活跃窗口
// 仅获取窗口标题用于识别应用类型，不记录内容
// ============================================================

export interface WindowData {
  title: string
  isIdle: boolean
  idleTime: number      // ms
}

export class WindowSensor extends EventEmitter {
  private currentTitle: string = ''
  private idleStart: number = 0
  private intervalId: NodeJS.Timeout | null = null
  private hasInput: boolean = false
  private running: boolean = false

  start() {
    if (this.running) return
    this.running = true

    this.intervalId = setInterval(async () => {
      const now = Date.now()

      try {
        const win = await activeWindow()
        if (win && win.title) {
          this.currentTitle = win.title
        }
      } catch {
        // ignore errors (e.g., during screen lock)
      }

      const idleTime = this.hasInput ? 0 : now - this.idleStart

      this.emit('data', {
        title: this.currentTitle,
        isIdle: idleTime > 30000,      // 30s 无操作视为空闲
        idleTime,
      })
    }, 2000)
  }

  /** 由外部调用 - 标记有输入活动 */
  markInput() {
    this.hasInput = true
    this.idleStart = Date.now()
  }

  /** 由外部调用 - 标记输入停止 */
  markIdle() {
    this.hasInput = false
    if (this.idleStart === 0) {
      this.idleStart = Date.now()
    }
  }

  stop() {
    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
