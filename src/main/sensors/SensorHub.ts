import { EventEmitter } from 'events'
import { uIOhook } from 'uiohook-napi'
import { SensorData } from '../../shared/types'
import { KeyboardSensor, KeyboardData } from './KeyboardSensor'
import { MouseSensor, MouseData } from './MouseSensor'
import { WindowSensor, WindowData } from './WindowSensor'

// ============================================================
// 传感器聚合中心
// 统一管理所有传感器，合并数据后发送到渲染进程
// ============================================================

export class SensorHub extends EventEmitter {
  private keyboard: KeyboardSensor
  private mouse: MouseSensor
  private window: WindowSensor
  private intervalId: NodeJS.Timeout | null = null
  private started: boolean = false

  private lastKeyboard: KeyboardData = { activity: 0, speed: 0, isActive: false }
  private lastMouse: MouseData = { activity: 0, speed: 0, isActive: false, position: { x: 0, y: 0 } }
  private lastWindow: WindowData = { title: '', isIdle: false, idleTime: 0 }

  constructor() {
    super()
    this.keyboard = new KeyboardSensor()
    this.mouse = new MouseSensor()
    this.window = new WindowSensor()
  }

  start() {
    if (this.started) return
    this.started = true

    // 启动全局输入钩子 (uiohook-napi)
    uIOhook.start()
    console.log('[SensorHub] 全局输入钩子已启动')

    // 监听子传感器
    this.keyboard.on('data', (data: KeyboardData) => {
      this.lastKeyboard = data
      if (data.isActive) {
        this.window.markInput()
      }
    })

    this.mouse.on('data', (data: MouseData) => {
      this.lastMouse = data
      if (data.isActive) {
        this.window.markInput()
      }
    })

    this.window.on('data', (data: WindowData) => {
      this.lastWindow = data
    })

    this.keyboard.start()
    this.mouse.start()
    this.window.start()

    // 每 200ms 合并数据发送
    this.intervalId = setInterval(() => {
      const data: SensorData = {
        keyboardActivity: this.lastKeyboard.activity,
        mouseActivity: this.lastMouse.activity,
        typingSpeed: this.lastKeyboard.speed,
        isActive: this.lastKeyboard.isActive || this.lastMouse.isActive,
        idleTime: this.lastWindow.idleTime,
        foregroundApp: this.lastWindow.title,
        mousePosition: this.lastMouse.position,
        timestamp: Date.now(),
      }

      this.emit('data', data)
    }, 200)

    console.log('[SensorHub] 传感器系统已启动')
  }

  stop() {
    this.started = false
    this.keyboard.stop()
    this.mouse.stop()
    this.window.stop()
    uIOhook.stop()
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('[SensorHub] 传感器系统已停止')
  }
}
