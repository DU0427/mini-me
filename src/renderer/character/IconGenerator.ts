import { IPC_CHANNELS } from '../../shared/types'

// ============================================================
// IconGenerator — 使用 Canvas 2D 绘制高质量系统托盘图标
// 由渲染进程绘制后通过 IPC 发送到主进程
// ============================================================

const SIZE = 128  // 高分辨率绘制，Electron 自动缩放

export function generateAndSendIcon() {
  const electronAPI = (() => {
    try {
      const electron = require('electron')
      return { ipcRenderer: electron.ipcRenderer }
    } catch {
      return { ipcRenderer: null as any }
    }
  })()
  const { ipcRenderer } = electronAPI
  if (!ipcRenderer) return

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const C = SIZE / 2  // center

  // ---- 1. 圆角矩形背景 ----
  const rr = 28  // 圆角半径
  const margin = 8
  ctx.beginPath()
  ctx.moveTo(margin + rr, margin)
  ctx.lineTo(SIZE - margin - rr, margin)
  ctx.quadraticCurveTo(SIZE - margin, margin, SIZE - margin, margin + rr)
  ctx.lineTo(SIZE - margin, SIZE - margin - rr)
  ctx.quadraticCurveTo(SIZE - margin, SIZE - margin, SIZE - margin - rr, SIZE - margin)
  ctx.lineTo(margin + rr, SIZE - margin)
  ctx.quadraticCurveTo(margin, SIZE - margin, margin, SIZE - margin - rr)
  ctx.lineTo(margin, margin + rr)
  ctx.quadraticCurveTo(margin, margin, margin + rr, margin)
  ctx.closePath()

  // 紫罗兰渐变背景
  const bgGrad = ctx.createRadialGradient(C - 15, C - 15, 5, C, C, C)
  bgGrad.addColorStop(0, '#C4B5FD')   // 淡紫
  bgGrad.addColorStop(0.5, '#A78BFA')  // 薰衣草
  bgGrad.addColorStop(1, '#7C3AED')    // 深紫
  ctx.fillStyle = bgGrad
  ctx.fill()

  // 顶部高光
  const hlGrad = ctx.createRadialGradient(C, C - 35, 5, C, C - 35, 50)
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.25)')
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hlGrad
  ctx.fill()

  // ---- 2. 白色脸蛋 ----
  ctx.beginPath()
  ctx.ellipse(C, C + 2, 40, 44, 0, 0, Math.PI * 2)
  const faceGrad = ctx.createRadialGradient(C - 8, C - 10, 5, C, C + 2, 44)
  faceGrad.addColorStop(0, '#FFFFFF')
  faceGrad.addColorStop(0.8, '#FDF8FF')
  faceGrad.addColorStop(1, '#F5EEFF')
  ctx.fillStyle = faceGrad
  ctx.fill()

  // ---- 3. 眼睛 ----
  const drawEye = (ex: number, ey: number) => {
    // 眼白
    ctx.beginPath()
    ctx.ellipse(ex, ey, 14, 16, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    // 外圈
    ctx.strokeStyle = '#E8DFFF'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 瞳孔
    ctx.beginPath()
    ctx.arc(ex + 1, ey + 1.5, 8.5, 0, Math.PI * 2)
    const pupilGrad = ctx.createRadialGradient(ex, ey, 2, ex + 1, ey + 1.5, 8.5)
    pupilGrad.addColorStop(0, '#4A4580')
    pupilGrad.addColorStop(0.6, '#2D2A55')
    pupilGrad.addColorStop(1, '#1A1830')
    ctx.fillStyle = pupilGrad
    ctx.fill()

    // 大高光
    ctx.beginPath()
    ctx.arc(ex - 3.5, ey - 4, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    // 小高光
    ctx.beginPath()
    ctx.arc(ex + 4.5, ey + 4.5, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fill()
  }

  drawEye(C - 17, C - 4)
  drawEye(C + 17, C - 4)

  // ---- 4. 腮红 ----
  ctx.beginPath()
  ctx.ellipse(C - 32, C + 10, 12, 7, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,180,180,0.35)'
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(C + 32, C + 10, 12, 7, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,180,180,0.35)'
  ctx.fill()

  // ---- 5. 微笑 ----
  ctx.beginPath()
  ctx.arc(C, C + 16, 14, 0.15, Math.PI - 0.15)
  ctx.strokeStyle = '#D4707A'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke()

  // ---- 转换为 PNG 并发送 ----
  const dataUrl = canvas.toDataURL('image/png')
  ipcRenderer.send(IPC_CHANNELS.ICON_DATA, dataUrl)
}
