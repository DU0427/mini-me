import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } from 'electron'
import path from 'path'
import { IPC_CHANNELS } from '../shared/types'
import { SensorHub } from './sensors/SensorHub'
import { ScreenCapture } from './sensors/ScreenCapture'
import { DailyStats } from './stats/DailyStats'

// ============================================================
// minime - Electron 主进程入口
// ============================================================

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let sensorHub: SensorHub | null = null
let screenCapture: ScreenCapture | null = null
let stats: DailyStats | null = null
let isQuitting = false

const WINDOW_WIDTH = 200
const WINDOW_HEIGHT = 280

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
    icon: iconPath,
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
  // 使用 assets/icon.png 作为托盘图标（由渲染进程生成）
  const iconPath = path.join(__dirname, '../../assets/icon.png')
  let trayIcon: nativeImage
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) throw new Error('empty')
  } catch {
    // 后备：生成一个简单的紫色圆点
    const size = 32
    const buf = Buffer.alloc(size * size * 4, 0)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const dx = x - 16, dy = y - 16
        if (dx * dx + dy * dy <= 169) {
          const dist = Math.sqrt(dx * dx + dy * dy) / 13
          buf[i] = Math.round(220 - dist * 70)
          buf[i + 1] = Math.round(160 - dist * 65)
          buf[i + 2] = Math.round(255 - dist * 55)
          buf[i + 3] = 255
        }
      }
    }
    trayIcon = nativeImage.createFromBitmap(buf, { width: size, height: size })
  }
  tray = new Tray(trayIcon)
  tray.setToolTip('minime - 你的桌面分身')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏 minime',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.setAlwaysOnTop(true)
          }
        }
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
      } else {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.setAlwaysOnTop(true)
      }
    }
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
