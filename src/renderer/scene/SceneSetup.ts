import * as THREE from 'three'

// ============================================================
// 场景初始化 — Q版卡通风格
// ============================================================

export class SceneSetup {
  public scene: THREE.Scene
  public camera: THREE.OrthographicCamera
  public renderer: THREE.WebGLRenderer

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()

    // 2.5D 正交相机 — viewSize 匹配窗口尺寸，角色居中
    const aspect = canvas.width / canvas.height
    const viewSize = 1.2
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize, 0.1, 10
    )
    this.camera.position.set(0, 0.55, 1.8)
    this.camera.lookAt(0, 0.30, 0)

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setSize(canvas.width, canvas.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    this.setupLights()
    window.addEventListener('resize', () => this.onResize(canvas))
  }

  private setupLights() {
    // 暖色环境光
    const hemi = new THREE.HemisphereLight(0xffeedd, 0x667788, 0.5)
    this.scene.add(hemi)

    // 主光源 — 暖白，右上前方
    const main = new THREE.DirectionalLight(0xfff4e6, 1.0)
    main.position.set(2.5, 4, 2.5)
    this.scene.add(main)

    // 补光 — 冷色，左后下方
    const fill = new THREE.DirectionalLight(0xccddff, 0.35)
    fill.position.set(-2, 1, 1.5)
    this.scene.add(fill)

    // 轮廓光 — 从背后打亮角色边缘
    const rim = new THREE.DirectionalLight(0xffffff, 0.5)
    rim.position.set(0, 2, -3)
    this.scene.add(rim)

    // 底部暖光 — 给阴影区域一点暖色反弹
    const bounce = new THREE.DirectionalLight(0xffcc88, 0.2)
    bounce.position.set(0, -1, 0.5)
    this.scene.add(bounce)
  }



  private onResize(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    const aspect = w / h, vs = 1.2
    this.camera.left = -vs * aspect; this.camera.right = vs * aspect
    this.camera.top = vs; this.camera.bottom = -vs
    this.camera.updateProjectionMatrix()
  }

  render() { this.renderer.render(this.scene, this.camera) }
  dispose() { this.renderer.dispose(); this.scene.clear() }
}
