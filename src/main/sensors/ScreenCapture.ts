import { desktopCapturer, BrowserWindow } from 'electron'

// ============================================================
// 屏幕捕获模块
// 捕获当前屏幕画面，发送到渲染进程作为小显示器纹理
// ============================================================

const CAPTURE_INTERVAL = 3000 // 每3秒捕获1帧（降低CPU负载）
const CAPTURE_QUALITY = 15    // JPEG质量（降低传输开销）

export class ScreenCapture {
  private intervalId: NodeJS.Timeout | null = null
  private running: boolean = false
  private onFrame: ((dataUrl: string) => void) | null = null
  private mainWindow: BrowserWindow | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  setFrameCallback(cb: (dataUrl: string) => void) {
    this.onFrame = cb
  }

  async start() {
    if (this.running) return
    this.running = true
    console.log('[ScreenCapture] 启动屏幕捕获')

    // 首次立即捕获
    await this.captureFrame()

    this.intervalId = setInterval(() => {
      this.captureFrame()
    }, CAPTURE_INTERVAL)
  }

  private async captureFrame() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 160, height: 100 },
        fetchWindowIcons: false,
      })

      if (sources.length > 0 && sources[0].thumbnail) {
        const thumbnail = sources[0].thumbnail
        const dataUrl = thumbnail.toDataURL('image/jpeg', CAPTURE_QUALITY / 100)

        if (this.onFrame) {
          this.onFrame(dataUrl)
        }
      }
    } catch (err) {
      // 首次捕获可能需要用户授权, 静默失败
    }
  }

  stop() {
    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('[ScreenCapture] 停止屏幕捕获')
  }

  isRunning(): boolean {
    return this.running
  }
}
