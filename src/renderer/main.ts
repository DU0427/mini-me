import { MinimeApp } from './MinimeApp'

// ============================================================
// minime - 渲染进程入口
// ============================================================

console.log('[minime] 启动中...')

const app = new MinimeApp()

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init()
  })
} else {
  app.init()
}

// 窗口关闭时清理
window.addEventListener('beforeunload', () => {
  app.dispose()
})
