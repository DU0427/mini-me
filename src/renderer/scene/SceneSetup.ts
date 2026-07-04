import * as THREE from 'three'

// ============================================================
// Three.js 场景初始化
// ============================================================

export class SceneSetup {
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer

  constructor(canvas: HTMLCanvasElement) {
    // 场景
    this.scene = new THREE.Scene()

    // 透视相机 - 过肩视角，有立体感
    const aspect = canvas.width / canvas.height
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100)
    // 从右后方偏上观察，看到小人的侧面和前方的桌子
    // 侧肩视角：避免身体遮挡键盘
    this.camera.position.set(0, 5, -2.5)
    this.camera.lookAt(0, -0.1, 0.5)

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    })
    this.renderer.setSize(canvas.width, canvas.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0) // 完全透明背景
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // 光照
    this.setupLights()

    // 背景 - 极淡的圆形光晕，让角色有存在感
    this.setupBackground()

    // 窗口大小变化
    window.addEventListener('resize', () => this.onResize(canvas))
  }

  private setupLights() {
    // 环境光 - 基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    // 主光源 - 从左上角打光
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0)
    mainLight.position.set(5, 5, 5)
    mainLight.castShadow = true
    this.scene.add(mainLight)

    // 补光 - 从右下角
    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.4)
    fillLight.position.set(-3, -2, 4)
    this.scene.add(fillLight)

    // 背光 - 勾勒轮廓
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rimLight.position.set(0, 0, -5)
    this.scene.add(rimLight)

    // 底部柔光
    const bottomLight = new THREE.DirectionalLight(0x88ccff, 0.2)
    bottomLight.position.set(0, -5, 3)
    this.scene.add(bottomLight)

    // 桌面重点补光，让键盘鼠标更清晰
    const deskLight = new THREE.DirectionalLight(0xffffff, 0.8)
    deskLight.position.set(0, 4, 1)
    this.scene.add(deskLight)
    // 正面柔光
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.3)
    frontLight.position.set(0, 1, 5)
    this.scene.add(frontLight)
  }

  private onResize(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private setupBackground() {
    // 极淡的圆形光晕 - 让角色看起来有"存在感"
    const glowGeometry = new THREE.CircleGeometry(2.5, 32)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.set(0, -0.5, -1)
    this.scene.add(glow)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.dispose()
    this.scene.clear()
  }
}
