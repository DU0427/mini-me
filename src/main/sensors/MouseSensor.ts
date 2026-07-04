import { EventEmitter } from 'events'
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi'

// ============================================================
// 鼠标活动传感器 - 统计移动和点击频率
// 使用 uiohook-napi 全局钩子，仅统计移动距离和点击次数
// ============================================================

export interface MouseData {
  activity: number            // 0-1 活跃度
  speed: number               // 像素/秒
  isActive: boolean
  position: { x: number; y: number }
}

export class MouseSensor extends EventEmitter {
  private moveDistance: number = 0
  private clickCount: number = 0
  private currentPosition = { x: 0, y: 0 }
  private lastPosition = { x: 0, y: 0 }
  private lastReset: number = Date.now()
  private intervalId: NodeJS.Timeout | null = null
  private running: boolean = false
  private hasTrackedMove: boolean = false

  start() {
    if (this.running) return
    this.running = true
    this.moveDistance = 0
    this.lastReset = Date.now()
    this.hasTrackedMove = false

    // 注册全局鼠标钩子
    uIOhook.on('mousemove', this.handleMouseMove)
    uIOhook.on('mousedown', this.handleMouseClick)

    this.intervalId = setInterval(() => {
      const elapsed = (Date.now() - this.lastReset) / 1000
      const speed = elapsed > 0 ? this.moveDistance / elapsed : 0
      const activity = Math.min(speed / 5000, 1)

      this.emit('data', {
        activity,
        speed,
        isActive: this.moveDistance > 0 || this.clickCount > 0,
        position: { ...this.currentPosition },
      })

      this.moveDistance = 0
      this.clickCount = 0
      this.lastReset = Date.now()
    }, 500)
  }

  /** uiohook 鼠标移动回调 */
  private handleMouseMove = (event: UiohookMouseEvent) => {
    if (!this.running) return

    if (this.hasTrackedMove) {
      const dx = event.x - this.lastPosition.x
      const dy = event.y - this.lastPosition.y
      this.moveDistance += Math.sqrt(dx * dx + dy * dy)
    }
    this.lastPosition = { x: event.x, y: event.y }
    this.currentPosition = { x: event.x, y: event.y }
    this.hasTrackedMove = true
  }

  /** uiohook 鼠标点击回调 */
  private handleMouseClick = () => {
    if (this.running) {
      this.clickCount++
      this.moveDistance += 100 // 每次点击相当于 100px 移动
    }
  }

  stop() {
    this.running = false
    uIOhook.removeListener('mousemove', this.handleMouseMove)
    uIOhook.removeListener('mousedown', this.handleMouseClick)
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
