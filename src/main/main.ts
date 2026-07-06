import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { IPC_CHANNELS, MinimeSettings } from '../shared/types'
import { SensorHub } from './sensors/SensorHub'
import { ScreenCapture } from './sensors/ScreenCapture'
import { DailyStats } from './stats/DailyStats'

// ============================================================
// minime - Electron 主进程入口
// ============================================================

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let sensorHub: SensorHub | null = null
let screenCapture: ScreenCapture | null = null
let stats: DailyStats | null = null
let isQuitting = false

const WINDOW_WIDTH = 135
const WINDOW_HEIGHT = 185

// ============================================================
// 设置存储
// ============================================================

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

const DEFAULT_SETTINGS: MinimeSettings = {
  drinkInterval: 45,
  standInterval: 60,
  eyeRestInterval: 30,
}

function loadSettings(): MinimeSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('[settings] 读取失败:', e)
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: MinimeSettings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
    console.log('[settings] 已保存:', settings)
  } catch (e) {
    console.error('[settings] 保存失败:', e)
  }
}

// ============================================================
// 图标生成 — 紫色渐变圆角方块 + 笑脸
// ============================================================

function generateAppIcon(): nativeImage {
  const size = 64
  const buf = Buffer.alloc(size * size * 4, 0)
  const C = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - C, dy = y - C
      const dist = Math.sqrt(dx * dx + dy * dy)
      // 圆角矩形 (半径 12)
      const rx = Math.abs(dx) - (C - 12)
      const ry = Math.abs(dy) - (C - 12)
      const cornerDist = Math.sqrt(Math.max(rx, 0) ** 2 + Math.max(ry, 0) ** 2)
      const inside = cornerDist <= 12 && Math.abs(dx) <= C - 12 + 12 && Math.abs(dy) <= C - 12 + 12
      if (inside) {
        const f = dist / C
        buf[i] = Math.round(180 - f * 60)       // R
        buf[i + 1] = Math.round(130 - f * 55)   // G
        buf[i + 2] = Math.round(255 - f * 50)   // B
        buf[i + 3] = 255                        // A
      }
    }
  }
  // 简单画两个小白点当眼睛
  const eyeY = Math.round(C - 4)
  const eyeOff = 10
  for (const ex of [C - eyeOff, C + eyeOff]) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy <= 9) {
          const px = ex + dx
          const py = eyeY + dy
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const i = (py * size + px) * 4
            buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255
          }
        }
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workArea

  // 图标路径
  const iconPath = path.join(__dirname, '../../assets/icon.png')

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: screenWidth - WINDOW_WIDTH - 20,
    y: screenHeight - WINDOW_HEIGHT - 10,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    icon: generateAppIcon(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // 用 CSS pointer-events 控制点击穿透（canvas 可穿透，UI 元素可交互）

  console.log('[minime] 窗口创建完成, 位置:', { x: screenWidth - WINDOW_WIDTH - 20, y: screenHeight - WINDOW_HEIGHT - 10 })

  // 加载页面
  const loadPage = async () => {
    try {
      if (process.env.VITE_DEV_SERVER_URL) {
        console.log('[minime] 加载开发服务器:', process.env.VITE_DEV_SERVER_URL)
        await mainWindow!.loadURL(process.env.VITE_DEV_SERVER_URL)
      } else {
        const filePath = path.join(__dirname, '../../dist/index.html')
        console.log('[minime] 加载本地文件:', filePath)
        await mainWindow!.loadFile(filePath)
      }
      console.log('[minime] 页面加载成功')
    } catch (err) {
      console.error('[minime] 页面加载失败:', err)
    }
  }
  loadPage()

  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false)

  // 窗口失去焦点也保持置顶
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true)
    }
  })

  // 关闭窗口时隐藏到系统托盘，不退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow!.hide()
      // 隐藏时关闭 DevTools，避免 DevTools 窗口散落在桌面上
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      }
    }
  })

  // 打开 DevTools 分离窗口（避免遮挡小人）
  mainWindow.webContents.openDevTools({ mode: 'detach' })
  // 将 DevTools 窗口移到屏幕另一侧
  if (mainWindow.webContents.devToolsWebContents) {
    const devToolsWin = mainWindow.webContents.devToolsWebContents as any
    // DevTools 自动以独立窗口打开，不会遮挡小人
  }
}

function createTray() {
  const trayIcon = generateAppIcon()
  tray = new Tray(trayIcon)
  tray.setToolTip('minime - 你的桌面分身')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏 minime',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
            // 隐藏时关闭 DevTools 避免散落桌面
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools()
            }
          } else {
            mainWindow.show()
            mainWindow.setAlwaysOnTop(true)
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        openSettingsWindow()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 点击托盘图标切换显示/隐藏（像 QQ 一样）
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        }
      } else {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.setAlwaysOnTop(true)
      }
    }
  })
}

// ============================================================
// 设置窗口
// ============================================================

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 620,
    height: 500,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'minime - 设置',
    icon: generateAppIcon(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // 加载设置页面
  const settingsPath = path.join(__dirname, '../../dist/settings.html')
  settingsWindow.loadFile(settingsPath)
  settingsWindow.setMenuBarVisibility(false)

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// IPC Handlers
function setupIPC() {
  // 窗口拖拽移动
  ipcMain.on(IPC_CHANNELS.WINDOW_CONTROL, (_event, command: string, data?: { x: number; y: number }) => {
    if (command === 'drag-move' && data && mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds()
      mainWindow.setBounds({
        x: bounds.x + data.x,
        y: bounds.y + data.y,
        width: bounds.width,
        height: bounds.height,
      })
    }
  })

  // 提醒响应
  ipcMain.on(IPC_CHANNELS.REMINDER_ACTION, (_event, action: string) => {
    if (stats) {
      if (action === 'completed') {
        stats.recordReminderCompleted()
      } else {
        stats.recordReminderSnoozed()
      }
    }
  })

  // 获取每日统计
  ipcMain.handle(IPC_CHANNELS.DAILY_STATS, () => {
    return stats?.getSummary() || null
  })

  // 从渲染进程接收图标数据
  ipcMain.on(IPC_CHANNELS.ICON_DATA, (_event, dataUrl: string) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl)
      if (!img.isEmpty() && tray && !tray.isDestroyed()) {
        tray.setImage(img)
      }
    } catch (e) {
      console.error('[main] 图标更新失败:', e)
    }
  })

  // ============================================================
  // 设置 IPC
  // ============================================================

  // 获取设置
  ipcMain.handle('settings:get', () => {
    return loadSettings()
  })

  // 保存设置
  ipcMain.handle('settings:save', (_event, settings: MinimeSettings) => {
    saveSettings(settings)
    // 通知主窗口设置已更新
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:updated', settings)
    }
    return true
  })
}

function startSensors() {
  sensorHub = new SensorHub()
  screenCapture = new ScreenCapture(mainWindow!)
  stats = new DailyStats()

  // 屏幕捕获 → 发送到渲染进程
  screenCapture.setFrameCallback((dataUrl) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SCREEN_FRAME, dataUrl)
    }
  })
  screenCapture.start()

  let sendCount = 0
  sensorHub.on('data', (data) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SENSOR_DATA, data)
        sendCount++
        if (sendCount % 25 === 0) {
          console.log(`[main] 传感器已发送 ${sendCount} 次, 键盘: ${data.typingSpeed.toFixed(1)}键/秒, 活跃: ${data.isActive}`)
        }
      }
    } catch { /* window destroyed */ }
  })

  sensorHub.start()
  console.log('[main] 传感器系统初始化完成')
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(() => {
  createWindow()
  createTray()
  setupIPC()
  startSensors()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // 不退出，窗口已隐藏到托盘
})

app.on('before-quit', () => {
  if (sensorHub) sensorHub.stop()
  if (stats) stats.save()
})
