import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ============================================================
// 3D 角色系统 - 外部 GLB 模型 (RobotExpressive)
// 使用 Mixamo 骨骼驱动动画
// ============================================================

export interface JointAngles {
  headTilt: number           // 头部倾斜 (x轴旋转)
  headTurn: number           // 头部转动 (y轴旋转)
  leftArmRaise: number       // 左臂抬起 (肩部x轴旋转)
  leftArmSwing: number       // 左臂前后摆 (肩部z轴旋转)
  rightArmRaise: number      // 右臂抬起
  rightArmSwing: number      // 右臂前后摆
  leftElbowBend: number      // 左肘弯曲
  rightElbowBend: number     // 右肘弯曲
  leftLegRaise: number       // 左腿抬起
  rightLegRaise: number      // 右腿抬起
  bodyLean: number           // 身体前倾/后仰
  bodySway: number           // 身体左右摆动
}

// 默认待机角度
const DEFAULT_IDLE: JointAngles = {
  headTilt: 0, headTurn: 0,
  leftArmRaise: -0.3, leftArmSwing: 0,
  rightArmRaise: -0.3, rightArmSwing: 0,
  leftElbowBend: 0.2, rightElbowBend: 0.2,
  leftLegRaise: 0, rightLegRaise: 0,
  bodyLean: 0, bodySway: 0,
}

export class Character3D {
  public group: THREE.Group
  public joints: { [key: string]: THREE.Object3D } = {}

  // 外部模型
  private modelLoaded: boolean = false
  private modelGroup: THREE.Group | null = null
  private bones: Map<string, THREE.Bone> = new Map()

  // 桌面道具
  private keyboard!: THREE.Group
  private monitor!: THREE.Group
  private monitorScreen!: THREE.Mesh
  private chair!: THREE.Group
  private mouse!: THREE.Mesh
  private propsGroup!: THREE.Group
  private sittingPose: boolean = true

  // 动画目标角度
  public targetAngles: JointAngles = { ...DEFAULT_IDLE }
  public currentAngles: JointAngles = { ...DEFAULT_IDLE }
  private isTyping: boolean = false
  private isThinking: boolean = false
  private isSleeping: boolean = false

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.buildProps()
    scene.add(this.group)
    this.setSitting(true)
    this.loadModel()
  }

  /** 加载 GLB 模型 */
  private loadModel() {
    const loader = new GLTFLoader()
    loader.load(
      './models/avatar.glb',
      (gltf) => {
        this.modelGroup = gltf.scene
        // 收集所有骨骼
        this.modelGroup.traverse((child) => {
          if (child instanceof THREE.Bone) {
            this.bones.set(child.name, child)
          }
        })
        // 缩放模型，角色默认已面向 +z（朝向桌子）
        this.modelGroup.scale.set(0.6, 0.6, 0.6)
        this.modelGroup.position.set(0, 0.25, 0)
        this.group.add(this.modelGroup)
        this.modelLoaded = true
        console.log('[Character3D] 模型加载完成, 骨骼数:', this.bones.size)
      },
      undefined,
      (error) => console.error('[Character3D] 模型加载失败:', error)
    )
  }

  /** 将关节角度应用到 Mixamo 骨骼 */
  private applyBoneAngles() {
    if (!this.modelLoaded) return
    const get = (name: string) => this.bones.get(name)
    get('mixamorigHead')?.rotation.set(this.currentAngles.headTilt, this.currentAngles.headTurn, 0)
    get('mixamorigLeftArm')?.rotation.set(this.currentAngles.leftArmRaise, 0, this.currentAngles.leftArmSwing)
    get('mixamorigRightArm')?.rotation.set(this.currentAngles.rightArmRaise, 0, this.currentAngles.rightArmSwing)
    get('mixamorigLeftForeArm')?.rotation.set(this.currentAngles.leftElbowBend, 0, 0)
    get('mixamorigRightForeArm')?.rotation.set(this.currentAngles.rightElbowBend, 0, 0)
    get('mixamorigLeftUpLeg')?.rotation.set(this.currentAngles.leftLegRaise, 0, 0)
    get('mixamorigRightUpLeg')?.rotation.set(this.currentAngles.rightLegRaise, 0, 0)
    get('mixamorigSpine')?.rotation.set(this.currentAngles.bodyLean, 0, this.currentAngles.bodySway)
  }

  private buildProps() {
    const bodyHeight = 1.8

    this.propsGroup = new THREE.Group()
    this.propsGroup.position.set(0, 1.8, 0.5)
    this.propsGroup.rotation.x = -0.3
    this.group.add(this.propsGroup)
    this.propsGroup.visible = false

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6, metalness: 0.05 })
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.7, metalness: 0.05 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.3 })
    const grayMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.4, metalness: 0.2 })
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.3, metalness: 0.4 })

    // ---- 桌子 ----
    const desktop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.3), woodMat)
    desktop.position.set(0, 0, 0)
    this.propsGroup.add(desktop)
    // 桌腿
    for (const x of [-1.0, 1.0]) {
      for (const z of [-0.50, 0.50]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.15, 6), woodDark)
        leg.position.set(x, -0.11, z)
        this.propsGroup.add(leg)
      }
    }

    // 显示器（超大，清晰可见）----
    this.monitor = new THREE.Group()
    // 屏幕（亮色发光）
    this.monitorScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 1.02),
      new THREE.MeshBasicMaterial({ 
        color: 0xf0f9ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
      })
    )
    this.monitorScreen.position.z = 0.05
    this.monitor.add(this.monitorScreen)
    // 边框
    const mBezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 1.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1e1e2e, roughness: 0.3, metalness: 0.4 })
    )
    this.monitor.add(mBezel)
    // 底座支架
    const mStand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), darkMat)
    mStand.position.set(0, -0.63, 0)
    this.monitor.add(mStand)
    // 底座脚
    const mFoot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), darkMat)
    mFoot.position.set(0, -0.74, 0.02)
    this.monitor.add(mFoot)
    // 显示器放高z（靠桌后方），利用倾斜=推远（远离相机）
    this.monitor.position.set(0, 1.1, 0.55)
    this.monitor.rotation.x = 0.3
    this.monitor.rotation.y = Math.PI
    this.propsGroup.add(this.monitor)

    // ---- 键盘（75% 机械键盘布局，含导航键和方向键）----
    this.keyboard = new THREE.Group()
    // 底座（加宽以容纳右侧导航列）
    const kbCaseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.2, metalness: 0.5 })
    const kbBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.6), kbCaseMat)
    this.keyboard.add(kbBase)

    // 键帽材质
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.15 })
    const keyMatDark = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.2 })
    const keyMatAccent = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.3, metalness: 0.1 })
    const keyMatNav = new THREE.MeshStandardMaterial({ color: 0xa5b4fc, roughness: 0.3, metalness: 0.1 })

    // 工具函数：创建一个键帽（带倒角效果：两层叠加）
    const addKey = (x: number, z: number, w: number = 1, dark: boolean = false, accent: boolean = false, nav: boolean = false) => {
      const kMat = accent ? keyMatAccent : (nav ? keyMatNav : (dark ? keyMatDark : keyMat))
      const kW = 0.055 * w
      const kD = 0.055
      // 键帽底座（加厚）
      const cap = new THREE.Mesh(new THREE.BoxGeometry(kW, 0.035, kD), kMat)
      cap.position.set(x, 0.042, z)
      this.keyboard.add(cap)
      // 键帽顶部（略小，模拟斜面，加厚）
      const capTop = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.85, 0.015, kD * 0.85), kMat)
      capTop.position.set(x, 0.062, z)
      this.keyboard.add(capTop)
    }

    // ---- 机械键盘 75% 完整布局 ----
    const KX = -0.62  // 起始 X（左移一点居中）
    const KS = 0.09   // 键间距
    const KZ = -0.24  // 起始 Z
    const NX = 11.7   // 导航列偏移量（相对于 KX）

    // Row 1（数字行）: Esc + 1-0 + Backspace + Ins + PgUp
    addKey(KX, KZ, 1, false)                // Esc
    for (let i = 0; i < 10; i++) addKey(KX + (i + 1) * KS, KZ) // 1-0
    addKey(KX + 11 * KS, KZ, 1.5, true)     // Backspace（加宽）
    addKey(KX + NX * KS, KZ, 1, false, false, true) // Insert
    addKey(KX + (NX + 1) * KS, KZ, 1, false, false, true) // Page Up

    // Row 2（字母行上半）: Tab + Q-P + [ ] \ + Del + PgDn
    addKey(KX, KZ + KS, 1.25, true)         // Tab（加宽）
    for (let i = 0; i < 10; i++) addKey(KX + (i + 1.25) * KS, KZ + KS) // Q-P
    addKey(KX + 11.25 * KS, KZ + KS, 1.25, true) // [ ] \（加宽）
    addKey(KX + NX * KS, KZ + KS, 1, false, false, true) // Delete
    addKey(KX + (NX + 1) * KS, KZ + KS, 1, false, false, true) // Page Down

    // Row 3（字母行下半）: Caps + A-L + Enter + Home + End
    addKey(KX, KZ + 2 * KS, 1.5, true)      // Caps Lock（加宽）
    for (let i = 0; i < 9; i++) addKey(KX + (i + 1.5) * KS, KZ + 2 * KS) // A-L
    addKey(KX + 10.5 * KS, KZ + 2 * KS, 1.5, true) // Enter（加宽）
    addKey(KX + NX * KS, KZ + 2 * KS, 1, false, false, true) // Home
    addKey(KX + (NX + 1) * KS, KZ + 2 * KS, 1, false, false, true) // End

    // Row 4（Shift 行）: Shift + Z-/ + Shift + ↑
    addKey(KX, KZ + 3 * KS, 1.7, true)      // Left Shift（加宽）
    for (let i = 0; i < 7; i++) addKey(KX + (i + 1.7) * KS, KZ + 3 * KS) // Z-/
    addKey(KX + 8.7 * KS, KZ + 3 * KS, 1.7, true) // Right Shift（加宽）
    // 方向键 ↑（在 Shift 行右侧）
    addKey(KX + (NX + 0.5) * KS, KZ + 3 * KS, 1, false, false, true) // ↑

    // Row 5（底部行）: Ctrl + Win + Alt + 空格 + Alt + Fn + Ctrl + ← ↓ →
    addKey(KX, KZ + 4 * KS, 1.2, true)      // Ctrl
    addKey(KX + 1.2 * KS, KZ + 4 * KS, 1, false) // Win
    addKey(KX + 2.2 * KS, KZ + 4 * KS, 1, false) // Alt
    addKey(KX + 3.5 * KS, KZ + 4 * KS, 4.2, false, true) // 空格（超宽蓝色）
    addKey(KX + 7.7 * KS, KZ + 4 * KS, 1, false) // Alt
    addKey(KX + 8.7 * KS, KZ + 4 * KS, 1)      // Fn
    addKey(KX + 9.7 * KS, KZ + 4 * KS, 1.2, true) // Ctrl
    // 方向键 ← ↓ →
    addKey(KX + NX * KS, KZ + 4 * KS, 1, false, false, true) // ←
    addKey(KX + (NX + 1) * KS, KZ + 4 * KS, 1, false, false, true) // ↓
    addKey(KX + (NX + 2) * KS, KZ + 4 * KS, 1, false, false, true) // →

    // 键盘位置（稍右移以保持画面居中）
    this.keyboard.position.set(0.1, 0.06, -0.4)
    this.keyboard.rotation.y = Math.PI
    this.propsGroup.add(this.keyboard)

    // ---- 鼠标（加大）----
    this.mouse = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), whiteMat)
    this.mouse.scale.set(1.0, 0.45, 1.5)
    this.mouse.position.set(-1.0, 0.04, -0.3)
    this.mouse.rotation.x = 0
    this.propsGroup.add(this.mouse)

    // 鼠标线
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 4), grayMat)
    cord.position.set(-0.97, -0.02, -0.3)
    cord.rotation.x = 0.6
    this.propsGroup.add(cord)

    // ============================================================
    // 椅子（默认坐姿用）
    // ============================================================
    this.chair = new THREE.Group()
    // 椅子放在模型臀部位置附近 (bodyHeight/2 + 0.15 = 1.05 相对于 body y=0.9)
    // 换算到 group 空间: 0.9 - 0.9 + 0.15 = 0.15
    this.chair.position.set(0, 0.15, -0.1)
    this.group.add(this.chair)

    const chairMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, metalness: 0.2 })
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.9 })

    // 椅背
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), chairMat)
    back.position.set(0, 0.3, -0.35)
    this.chair.add(back)

    // 坐垫
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.45), cushionMat)
    seat.position.set(0, -0.05, 0.05)
    this.chair.add(seat)

    // 椅腿 x4
    const legPositions = [
      [-0.28, -0.4, 0.2],
      [0.28, -0.4, 0.2],
      [-0.28, -0.4, -0.15],
      [0.28, -0.4, -0.15],
    ]
    for (const pos of legPositions) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), chairMat)
      leg.position.set(pos[0], pos[1], pos[2])
      this.chair.add(leg)
    }

    // ============================================================
    // 脚下阴影
    // ============================================================
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), shadowMat)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0, -0.5, 0)
    this.group.add(shadow)

    // 整体位置调整 - 让角色站在"地面"上
    this.group.position.y = -2.5
  }

  // ============================================================
  // 桌面道具可见性
  // ============================================================

  setPropsVisible(visible: boolean) {
    this.propsGroup.visible = visible
  }

  private monitorImg: HTMLImageElement | null = null
  private monitorCanvas: HTMLCanvasElement | null = null
  private monitorCtx: CanvasRenderingContext2D | null = null
  private oldMonitorTexture: THREE.CanvasTexture | null = null

  setMonitorTexture(imageDataUrl: string) {
    if (!this.monitorScreen) return
    // 复用 Image 和 Canvas，避免频繁 GC
    if (!this.monitorImg) this.monitorImg = new Image()
    if (!this.monitorCanvas) {
      this.monitorCanvas = document.createElement('canvas')
      this.monitorCanvas.width = 320; this.monitorCanvas.height = 200
      this.monitorCtx = this.monitorCanvas.getContext('2d')!
    }
    const img = this.monitorImg
    const canvas = this.monitorCanvas
    const ctx = this.monitorCtx!
    img.onload = () => {
      const srcAspect = img.width / img.height
      const dstAspect = 320 / 200
      let sx = 0, sy = 0, sw = img.width, sh = img.height
      if (srcAspect > dstAspect) { sw = img.height * dstAspect; sx = (img.width - sw) / 2 }
      else { sh = img.width / dstAspect; sy = (img.height - sh) / 2 }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 320, 200)
      // 释放旧纹理（GPU 内存）
      if (this.oldMonitorTexture) this.oldMonitorTexture.dispose()
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      this.oldMonitorTexture = texture
      if (this.monitorScreen.material instanceof THREE.MeshBasicMaterial) {
        this.monitorScreen.material.map = texture
        this.monitorScreen.material.needsUpdate = true
      }
    }
    img.src = imageDataUrl
  }

  // ============================================================
  // 预设动作
  // ============================================================

  setSitting(sitting: boolean) {
    this.sittingPose = sitting
    if (sitting) { this.setIdle() }
    else { this.targetAngles = { ...DEFAULT_IDLE }; this.setPropsVisible(false) }
  }

  setIdle() {
    this.isTyping = false; this.isThinking = false; this.isSleeping = false
    if (this.sittingPose) {
      this.targetAngles = {
        headTilt: 0.05, headTurn: 0,
        leftArmRaise: -0.5, leftArmSwing: 0.25,
        rightArmRaise: -0.5, rightArmSwing: -0.25,
        leftElbowBend: 1.0, rightElbowBend: 1.0,
        leftLegRaise: -1.0, rightLegRaise: -1.0,
        bodyLean: 0.05, bodySway: 0,
      }
      this.setPropsVisible(true)
    } else {
      this.targetAngles = { ...DEFAULT_IDLE }
      this.setPropsVisible(false)
    }
  }

  setTyping() {
    this.isTyping = true; this.isThinking = false; this.isSleeping = false
    this.targetAngles = {
      headTilt: 0.08, headTurn: 0,
      leftArmRaise: -0.6, leftArmSwing: 0.4,
      rightArmRaise: -0.6, rightArmSwing: -0.4,
      leftElbowBend: 1.0, rightElbowBend: 1.0,
      leftLegRaise: -1.0, rightLegRaise: -1.0,
      bodyLean: 0.1, bodySway: 0,
    }
    this.setPropsVisible(true)
  }

  setThinking() {
    this.isTyping = false; this.isThinking = true; this.isSleeping = false
    this.targetAngles = {
      headTilt: 0.3, headTurn: 0.2,
      leftArmRaise: 0.5, leftArmSwing: 0,
      rightArmRaise: -0.4, rightArmSwing: 0,
      leftElbowBend: 1.5, rightElbowBend: 0.3,
      leftLegRaise: -1.0, rightLegRaise: -1.0,
      bodyLean: -0.1, bodySway: 0,
    }
    this.setPropsVisible(true)
  }

  setReminding() {
    this.isTyping = false; this.isThinking = false; this.isSleeping = false
    this.targetAngles = {
      headTilt: 0, headTurn: 0,
      leftArmRaise: -1.2, leftArmSwing: 0.2,
      rightArmRaise: -1.2, rightArmSwing: -0.2,
      leftElbowBend: 0.8, rightElbowBend: 0.8,
      leftLegRaise: -1.0, rightLegRaise: -1.0,
      bodyLean: 0.15, bodySway: 0,
    }
    this.setPropsVisible(false)
  }

  setSleeping() {
    this.isTyping = false; this.isThinking = false; this.isSleeping = true
    this.targetAngles = {
      headTilt: 1.2, headTurn: 0,
      leftArmRaise: 0.2, leftArmSwing: 0.5,
      rightArmRaise: 0.2, rightArmSwing: -0.5,
      leftElbowBend: 1.5, rightElbowBend: 1.5,
      leftLegRaise: -1.0, rightLegRaise: -1.0,
      bodyLean: 0.5, bodySway: 0,
    }
    this.setPropsVisible(true)
  }

  setWalking() {
    this.isTyping = false; this.isThinking = false; this.isSleeping = false
    this.targetAngles = {
      headTilt: 0, headTurn: 0,
      leftArmRaise: -0.3, leftArmSwing: 0.5,
      rightArmRaise: -0.3, rightArmSwing: -0.5,
      leftElbowBend: 0.2, rightElbowBend: 0.2,
      leftLegRaise: 0.3, rightLegRaise: -0.3,
      bodyLean: 0.05, bodySway: 0,
    }
    this.setPropsVisible(false)
  }

  // ============================================================
  // 动画更新 (每帧调用)
  // ============================================================

  update(deltaTime: number, time: number) {
    const lerpSpeed = 5.0
    const dt = Math.min(deltaTime, 0.1)

    // IDLE 呼吸
    if (this.isAtTarget(this.currentAngles, DEFAULT_IDLE)) {
      const breath = Math.sin(time * 2) * 0.02
      this.group.position.y = -2.5 + breath
    }

    // TYPING 敲击动画 + 键盘发光（使用状态标志，不受角度插值干扰）
    if (this.isTyping) {
      const tapSpeed = 12
      const tapPhase = time * tapSpeed
      const tapOffset = Math.sin(tapPhase) * 0.4
      this.currentAngles.leftElbowBend = this.targetAngles.leftElbowBend + tapOffset
      this.currentAngles.rightElbowBend = this.targetAngles.rightElbowBend - tapOffset
      this.currentAngles.leftArmSwing = this.targetAngles.leftArmSwing + Math.sin(tapPhase * 1.3) * 0.1
      this.currentAngles.rightArmSwing = this.targetAngles.rightArmSwing + Math.sin(tapPhase * 1.3 + 1) * 0.1
      // 键盘键位发光（已禁用）
      // 显示器微光（已禁用）
      this.applyBoneAngles()
      return
    }

    // SLEEPING 点头
    if (this.isSleeping) {
      const nod = Math.sin(time * 0.5) * 0.1
      this.currentAngles.headTilt = this.targetAngles.headTilt + nod
      this.applyBoneAngles()
      return
    }

    // THINKING 鼠标移动
    if (this.isThinking) {
      const mouseMove = Math.sin(time * 2.5) * 0.15
      const mouseSwing = Math.sin(time * 1.8) * 0.1
      this.currentAngles.rightArmRaise = this.targetAngles.rightArmRaise + mouseMove
      this.currentAngles.rightArmSwing = this.targetAngles.rightArmSwing + mouseSwing
      this.applyBoneAngles()
      return
    }

    // 常规插值
    this.lerpJoints(this.targetAngles, dt * lerpSpeed)
    this.applyBoneAngles()
  }

  private lerpJoints(target: JointAngles, speed: number) {
    const keys = Object.keys(this.currentAngles) as (keyof JointAngles)[]
    for (const key of keys) {
      this.currentAngles[key] += (target[key] - this.currentAngles[key]) * speed
    }
  }

  private isAtTarget(current: JointAngles, target: JointAngles, threshold = 0.05): boolean {
    const keys = Object.keys(current) as (keyof JointAngles)[]
    for (const key of keys) {
      if (Math.abs(current[key] - target[key]) > threshold) return false
    }
    return true
  }

  private getTypingAngles(): JointAngles {
    return {
      headTilt: 0.08, headTurn: 0,
      leftArmRaise: -0.6, leftArmSwing: 0.4,
      rightArmRaise: -0.6, rightArmSwing: -0.4,
      leftElbowBend: 1.0, rightElbowBend: 1.0,
      leftLegRaise: 0, rightLegRaise: 0,
      bodyLean: 0.1, bodySway: 0,
    }
  }

  private getThinkingAngles(): JointAngles {
    return {
      headTilt: 0.3, headTurn: 0.2,
      leftArmRaise: 0.5, leftArmSwing: 0,
      rightArmRaise: -0.5, rightArmSwing: 0,
      leftElbowBend: 1.5, rightElbowBend: 0.3,
      leftLegRaise: 0, rightLegRaise: 0,
      bodyLean: -0.1, bodySway: 0,
    }
  }

  private getSleepingAngles(): JointAngles {
    return {
      headTilt: 0.8, headTurn: 0.3,
      leftArmRaise: -0.5, leftArmSwing: 0.2,
      rightArmRaise: -0.5, rightArmSwing: -0.2,
      leftElbowBend: 0.5, rightElbowBend: 0.5,
      leftLegRaise: 0, rightLegRaise: 0,
      bodyLean: 0.3, bodySway: 0.1,
    }
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}
