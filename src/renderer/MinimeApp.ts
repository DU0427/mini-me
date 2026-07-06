import { SceneSetup } from './scene/SceneSetup'
import { Character3D } from './character/Character3D'
import { StateMachine } from './states/StateMachine'
import { ReminderManager } from './reminders/ReminderManager'
import { SensorData, MinimeState, IPC_CHANNELS, ReminderEvent } from '../shared/types'
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

    // 创建 HUD 卡片系统
    this.createHUD()

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
      this.updateStateBadge(newState)
      this.showStateBubble(newState)
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

    // 更新 HUD 卡片 (每秒更新 4 次)
    const now = Date.now()
    if (now - this.lastDebugUpdate > 250) {
      this.updateHUD(data)
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

  // 状态消息气泡
  private stateMessages: Record<string, string> = {
    idle: '今天也一起活下来 ☕',
    typing: '一起敲键盘！ ⌨️',
    thinking: '让我想想… 🤔',
    drink: '喝点水吧？ 💧',
    stretch: '伸个懒腰～ 🌟',
    sleepy: '我还能陪你…但你明天可能会后悔 😴',
    focus: '专注模式 🎧',
    privacy: '🙈 非礼勿视',
  }

  private showStateBubble(state: string) {
    const container = document.getElementById('state-bubble-container')
    if (!container) return

    // 清除旧气泡
    if (this.stateBubbleTimeout) {
      clearTimeout(this.stateBubbleTimeout)
    }
    const old = container.querySelector('.state-bubble')
    if (old) old.remove()

    const msg = this.stateMessages[state]
    if (!msg) return

    const bubble = document.createElement('div')
    bubble.className = 'state-bubble'
    bubble.textContent = msg
    container.appendChild(bubble)

    // 3 秒后淡出
    this.stateBubbleTimeout = setTimeout(() => {
      bubble.classList.add('fade-out')
      setTimeout(() => bubble.remove(), 300)
    }, 3000)
  }

  // ============================================================
  // HUD — SINGLE UNIFIED FLOATING PANEL
  // ============================================================

  private panelSpeed!: HTMLElement
  private panelActivity!: HTMLElement
  private panelLoad!: HTMLElement
  private panelIdle!: HTMLElement
  private pillText!: HTMLElement
  private hintText!: HTMLElement
  private sourceBadge!: HTMLElement
  private statusPill!: HTMLElement

  private createHUD() {
    const container = document.getElementById('hud-container')!
    if (!container) return

    container.innerHTML = `
      <div class="unified-panel">
        <!-- Layer 1: 状态胶囊 -->
        <div class="panel-header">
          <div class="status-pill active" id="status-pill">
            <span class="dot"></span>
            <span id="pill-text">Active</span>
          </div>
          <span class="panel-title">minime</span>
        </div>

        <!-- Layer 2: 2×2 指标网格 -->
        <div class="metrics-grid">
          <div class="metric-block">
            <div class="metric-value" id="panel-speed">0.0</div>
            <div class="metric-label">Speed</div>
          </div>
          <div class="metric-block">
            <div class="metric-value" id="panel-activity">0%</div>
            <div class="metric-label">Activity</div>
          </div>
          <div class="metric-block">
            <div class="metric-value" id="panel-load">0%</div>
            <div class="metric-label">Load</div>
          </div>
          <div class="metric-block">
            <div class="metric-value" id="panel-idle">0s</div>
            <div class="metric-label">Idle</div>
          </div>
        </div>

        <!-- Layer 3: 底部辅助状态 -->
        <div class="panel-footer">
          <span class="hint-text" id="hint-text">Syncing...</span>
          <span class="source-badge" id="source-badge">⟳ simulation</span>
        </div>
      </div>
    `

    this.panelSpeed = document.getElementById('panel-speed')!
    this.panelActivity = document.getElementById('panel-activity')!
    this.panelLoad = document.getElementById('panel-load')!
    this.panelIdle = document.getElementById('panel-idle')!
    this.pillText = document.getElementById('pill-text')!
    this.hintText = document.getElementById('hint-text')!
    this.sourceBadge = document.getElementById('source-badge')!
    this.statusPill = document.getElementById('status-pill')!
  }

  private updateHUD(data: SensorData) {
    if (this.panelSpeed) {
      this.panelSpeed.textContent = data.typingSpeed.toFixed(1)
    }
    if (this.panelActivity) {
      const pct = Math.round((data.keyboardActivity + data.mouseActivity) * 50)
      this.panelActivity.textContent = `${pct}%`
    }
    if (this.panelLoad) {
      const load = Math.min(100, data.typingSpeed * 12)
      this.panelLoad.textContent = `${Math.round(load)}%`
    }
    if (this.panelIdle) {
      const sec = Math.floor(data.idleTime / 1000)
      this.panelIdle.textContent = sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`
    }
    if (this.sourceBadge) {
      this.sourceBadge.textContent = this.dataReceived ? '● main' : '⟳ simulation'
      this.sourceBadge.style.color = this.dataReceived
        ? 'rgba(110, 168, 255, 0.5)'
        : 'rgba(255, 200, 100, 0.4)'
    }
    if (this.hintText) {
      this.hintText.textContent = this.dataReceived ? 'Processing...' : 'Syncing...'
    }
  }

  private updateStateBadge(state: MinimeState) {
    if (!this.pillText || !this.statusPill) return

    const labels: Record<string, string> = {
      idle: 'Idle', typing: 'Active', thinking: 'Thinking',
      reminding: 'Alert', sleeping: 'Sleep', walking: 'Walking',
    }

    const pillClasses: Record<string, string> = {
      idle: 'active', typing: 'active', thinking: 'active',
      reminding: 'alert', sleeping: 'warning', walking: 'active',
    }

    this.pillText.textContent = labels[state] || 'Idle'
    this.statusPill.className = `status-pill ${pillClasses[state] || 'active'}`
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
