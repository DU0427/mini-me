import { SceneSetup } from './scene/SceneSetup'
import { Character3D } from './character/Character3D'
import { StateMachine } from './states/StateMachine'
import { ReminderManager } from './reminders/ReminderManager'
import { SensorData, MinimeState, IPC_CHANNELS, ReminderEvent, MinimeSettings } from '../shared/types'
import { generateAndSendIcon } from './character/IconGenerator'

// ============================================================
// minime 主应用 - 协调场景、角色、状态机、提醒系统
// ============================================================

// Electron IPC - 通过 Node 集成访问
const electronAPI = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron')
    return { ipcRenderer: electron.ipcRenderer }
  } catch {
    return { ipcRenderer: null as any }
  }
})()
const { ipcRenderer } = electronAPI

export class MinimeApp {
  private scene!: SceneSetup
  private character!: Character3D
  private stateMachine!: StateMachine
  private reminderManager!: ReminderManager
  private canvas!: HTMLCanvasElement
  private overlay!: HTMLElement

  private lastSensorData: SensorData | null = null
  private animFrameId: number = 0
  private lastTime: number = 0
  private lastDebugUpdate: number = 0
  private sensorTimeout: ReturnType<typeof setTimeout> | null = null
  private dataReceived: boolean = false
  private stateBubbleTimeout: ReturnType<typeof setTimeout> | null = null

  // 每日数据累积
  private typingAccumulator: number = 0
  private activeAccumulator: number = 0
  private lastLogTime: number = Date.now()

  async init() {
    this.canvas = document.getElementById('three-canvas') as HTMLCanvasElement
    this.overlay = document.getElementById('ui-overlay') as HTMLElement

    if (!this.canvas) {
      console.error('Canvas element not found')
      return
    }

    // 设置 canvas 尺寸
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight

    // 初始化场景
    this.scene = new SceneSetup(this.canvas)

    // 初始化角色
    this.character = new Character3D(this.scene.scene)

    // 初始化状态机
    this.stateMachine = new StateMachine(this.character)

    // 初始化提醒管理器
    this.reminderManager = new ReminderManager(this.stateMachine)
    this.reminderManager.setCallbacks(
      (event) => this.onReminderTriggered(event),
      () => this.onReminderDismissed()
    )

    // 加载设置
    this.loadSettings()

    // 监听设置更新
    if (ipcRenderer) {
      ipcRenderer.on('settings:updated', (_event: any, settings: MinimeSettings) => {
        console.log('[minime] 设置已更新:', settings)
        this.reminderManager.updateSettings(settings)
        if (settings.skin && this.character) {
          this.character.setSkin(settings.skin as any)
        }
      })
    }

    // 监听状态变化
    this.stateMachine.onStateChange((newState, oldState) => {
      console.log(`[minime] 状态: ${oldState} → ${newState}`)
    })

    // 传感器数据方案:
    // - 优先使用主进程实时传感器 (uiohook 全局钩子)
    // - 3 秒内无有效数据 → 切换到渲染进程模拟传感器
    if (ipcRenderer) {
      ipcRenderer.on(IPC_CHANNELS.SENSOR_DATA, (_event: any, data: SensorData) => {
        if (this.simInterval) return // 模拟器已启动, 忽略 IPC 数据
        if (data.typingSpeed > 0.1 || data.mouseActivity > 0.05) {
          if (!this.dataReceived) {
            this.dataReceived = true
            console.log('[minime] 收到真实传感器数据!')
            if (this.sensorTimeout) {
              clearTimeout(this.sensorTimeout)
              this.sensorTimeout = null
            }
          }
          this.onSensorData(data)
        }
      })

      // 3 秒后备: 如果真实传感器无数据, 启动模拟
      this.sensorTimeout = setTimeout(() => {
        if (!this.dataReceived) {
          console.warn('[minime] 真实传感器无响应, 启动模拟传感器')
          this.startSimulatedSensor()
        }
      }, 3000)
    } else {
      console.log('[minime] 使用模拟传感器数据')
      this.startSimulatedSensor()
    }

    // 监听屏幕帧（桌面缩略图 → 小显示器）
    if (ipcRenderer) {
      ipcRenderer.on(IPC_CHANNELS.SCREEN_FRAME, (_event: any, dataUrl: string) => {
        this.character.setMonitorTexture(dataUrl)
      })
    }

    // 拖拽移动窗口
    this.setupDrag()

    // 生成高质量系统托盘图标
    setTimeout(() => generateAndSendIcon(), 500)

    // 启动渲染循环
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private onSensorData(data: SensorData) {
    this.lastSensorData = data

    // 更新状态机
    this.stateMachine.update(data)

    // 更新提醒管理器
    this.reminderManager.update(data)

    // 累积数据
    this.accumulateData(data)
  }

  private accumulateData(data: SensorData) {
    const now = Date.now()
    const elapsed = (now - this.lastLogTime) / 1000 / 60 // 分钟

    if (elapsed >= 1) {
      if (data.isActive) {
        this.activeAccumulator += elapsed
      }
      if (data.typingSpeed > 2) {
        this.typingAccumulator += elapsed
      }
      this.lastLogTime = now
    }
  }

  private onReminderTriggered(event: ReminderEvent) {
    console.log(`[minime] 提醒: ${event.message}`)
    this.showReminderBubble(event)
  }

  private onReminderDismissed() {
    this.hideReminderBubble()
  }

  private showReminderBubble(event: ReminderEvent) {
    // 清除旧气泡
    this.hideReminderBubble()

    const bubble = document.createElement('div')
    bubble.className = `reminder-bubble type-${event.type} level-${event.level}`
    bubble.id = 'reminder-bubble'

    // 根据提醒类型设置不同的图标和颜色
    const typeMeta: Record<string, { icon: string; accent: string }> = {
      drink_water: { icon: '💧', accent: '#60B0FF' },
      stand_up: { icon: '🦵', accent: '#FFAA44' },
      late_night: { icon: '🌙', accent: '#818CF8' },
      eye_rest: { icon: '👀', accent: '#34D399' },
    }
    const meta = typeMeta[event.type] || { icon: '🔔', accent: '#6EA8FF' }

    bubble.innerHTML = `
      <span class="bubble-icon">${meta.icon}</span>
      <span class="bubble-msg">${event.message}</span>
    `

    // 点击 = 完成
    bubble.addEventListener('click', () => {
      this.reminderManager.completeReminder()
      if (ipcRenderer) {
        ipcRenderer.send(IPC_CHANNELS.REMINDER_ACTION, 'completed')
      }
    })

    // 右键 = 忽略
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.reminderManager.snoozeReminder()
      if (ipcRenderer) {
        ipcRenderer.send(IPC_CHANNELS.REMINDER_ACTION, 'snoozed')
      }
    })

    this.overlay.innerHTML = ''
    this.overlay.appendChild(bubble)
    this.overlay.classList.add('visible')

    // 10秒后自动消失（忽略）
    setTimeout(() => {
      if (document.getElementById('reminder-bubble')) {
        this.reminderManager.snoozeReminder()
      }
    }, 10000)
  }

  private hideReminderBubble() {
    const bubble = document.getElementById('reminder-bubble')
    if (bubble) {
      bubble.style.animation = 'pop-out 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards'
      setTimeout(() => {
        bubble.remove()
      }, 200)
    }
    this.overlay.classList.remove('visible')
  }

  // ============================================================
  // 窗口拖拽
  // ============================================================

  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0

  private setupDrag() {
    const el = document.getElementById('app')!

    el.addEventListener('mousedown', (e: MouseEvent) => {
      this.isDragging = true
      this.dragStartX = e.screenX
      this.dragStartY = e.screenY
    })

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return
      const dx = e.screenX - this.dragStartX
      const dy = e.screenY - this.dragStartY
      this.dragStartX = e.screenX
      this.dragStartY = e.screenY
      if (ipcRenderer) {
        ipcRenderer.send(IPC_CHANNELS.WINDOW_CONTROL, 'drag-move', { x: dx, y: dy })
      }
    })

    document.addEventListener('mouseup', () => {
      this.isDragging = false
    })
  }

  // ============================================================
  // 渲染循环
  // ============================================================

  private loop = (time: number) => {
    this.animFrameId = requestAnimationFrame(this.loop)

    const rawDelta = (time - this.lastTime) / 1000
    this.lastTime = time

    // 限制更新频率到 30fps，降低 CPU 负载
    const dt = Math.min(rawDelta, 0.1) // 防止大跳帧
    this.character.update(dt, time / 1000)
    this.scene.render()
  }

  // ============================================================
  // 开发模式 - 模拟传感器数据
  // ============================================================

  private simInterval: NodeJS.Timeout | null = null

  private startSimulatedSensor() {
    let typing = false
    let idleStart = Date.now()

    this.simInterval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - idleStart

      // 每 15s 切换一次打字/空闲
      if (elapsed > 15000) {
        typing = !typing
        idleStart = now
      }

      const data: SensorData = {
        keyboardActivity: typing ? 0.7 : 0,
        mouseActivity: typing ? 0.3 : 0,
        typingSpeed: typing ? 6 + Math.random() * 4 : 0,
        isActive: typing,
        idleTime: typing ? 0 : elapsed,
        foregroundApp: typing ? 'Visual Studio Code' : '',
        mousePosition: { x: Math.random() * 1920, y: Math.random() * 1080 },
        timestamp: now,
      }

      this.onSensorData(data)
    }, 500)
  }

  // ============================================================
  // 设置
  // ============================================================

  private async loadSettings() {
    if (!ipcRenderer) return
    try {
      const settings: MinimeSettings = await ipcRenderer.invoke('settings:get')
      if (settings) {
        this.reminderManager.updateSettings(settings)
        if (settings.skin && this.character) {
          this.character.setSkin(settings.skin as any)
        }
      }
    } catch (e) {
      console.error('[minime] 加载设置失败:', e)
    }
  }

  // ============================================================
  // 清理
  // ============================================================

  dispose() {
    cancelAnimationFrame(this.animFrameId)
    if (this.simInterval) {
      clearInterval(this.simInterval)
    }
    this.character.dispose()
    this.scene.dispose()
  }
}
