import { SceneSetup } from './scene/SceneSetup'
import { Character3D } from './character/Character3D'
import { StateMachine } from './states/StateMachine'
import { ReminderManager } from './reminders/ReminderManager'
import { SensorData, MinimeState, IPC_CHANNELS, ReminderEvent } from '../shared/types'

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
  private stateIndicator!: HTMLElement
  private debugPanel!: HTMLElement
  private sensorTimeout: ReturnType<typeof setTimeout> | null = null
  private dataReceived: boolean = false

  // 每日数据累积
  private typingAccumulator: number = 0
  private activeAccumulator: number = 0
  private lastLogTime: number = Date.now()

  async init() {
    this.canvas = document.getElementById('three-canvas') as HTMLCanvasElement
    this.overlay = document.getElementById('ui-overlay') as HTMLElement
    this.stateIndicator = document.getElementById('state-indicator') as HTMLElement

    if (!this.canvas) {
      console.error('Canvas element not found')
      return
    }

    // 创建调试面板
    this.createDebugPanel()

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

    // 监听状态变化
    this.stateMachine.onStateChange((newState, oldState) => {
      console.log(`[minime] 状态: ${oldState} → ${newState}`)
      this.updateStateIndicator(newState)
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

    // 更新调试面板 (每秒更新4次, 避免性能开销)
    const now = Date.now()
    if (now - this.lastDebugUpdate > 250) {
      this.updateDebugPanel(data)
      this.lastDebugUpdate = now
    }

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
    bubble.className = 'reminder-bubble'
    bubble.textContent = event.message
    bubble.id = 'reminder-bubble'

    // 点击气泡 = 完成提醒
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
      bubble.remove()
    }
    this.overlay.classList.remove('visible')
  }

  private updateStateIndicator(state: MinimeState) {
    const labels: Record<string, string> = {
      idle: '💤 待机中',
      typing: '⌨️ 打字中',
      thinking: '🤔 思考中',
      reminding: '🔔 提醒中',
      sleeping: '😴 睡着了',
      walking: '🚶 走动中',
    }
    if (this.stateIndicator) {
      this.stateIndicator.textContent = labels[state] || state
    }
  }

  // ============================================================
  // 调试面板
  // ============================================================

  private createDebugPanel() {
    this.debugPanel = document.createElement('div')
    this.debugPanel.id = 'debug-panel'
    this.debugPanel.style.cssText = `
      position: absolute; top: 4px; left: 4px; right: 4px;
      font-size: 10px; color: rgba(255,255,255,0.7);
      font-family: monospace;
      pointer-events: none;
      display: flex; flex-direction: column; gap: 2px;
    `
    this.debugPanel.innerHTML = `
      <div id="dbg-source">传感器: 等待中...</div>
      <div id="dbg-kb">键盘: 0 键/秒</div>
      <div id="dbg-mouse">鼠标: 0</div>
      <div id="dbg-idle">空闲: 0s</div>
    `
    document.getElementById('app')?.appendChild(this.debugPanel)
  }

  private updateDebugPanel(data: SensorData) {
    const source = document.getElementById('dbg-source')
    const kb = document.getElementById('dbg-kb')
    const mouse = document.getElementById('dbg-mouse')
    const idle = document.getElementById('dbg-idle')
    if (source) source.textContent = `传感器: ${this.dataReceived ? '主进程 ✓' : '模拟 🔄'}`
    if (kb) kb.textContent = `键盘: ${data.typingSpeed.toFixed(1)} 键/秒 | 活跃: ${(data.keyboardActivity * 100).toFixed(0)}%`
    if (mouse) mouse.textContent = `鼠标: ${(data.mouseActivity * 100).toFixed(0)}%`
    if (idle) idle.textContent = `空闲: ${(data.idleTime / 1000).toFixed(0)}s`
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
