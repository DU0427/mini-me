import * as THREE from 'three'

// ============================================================
// MiniMeAvatar — 2D Canvas 绘制 Q 版桌面精灵
// 使用 Canvas 2D API 绘制插画风格角色，再用 Sprite 渲染到 3D 场景
// ============================================================

export type MiniMeState = 'idle' | 'typing' | 'thinking' | 'drink' | 'stretch' | 'sleepy' | 'focus' | 'privacy' | 'reminding'
export type ReminderKind = 'drink_water' | 'stand_up' | 'late_night' | 'eye_rest'

export class MiniMeAvatar {
  public group: THREE.Group
  private sprite: THREE.Sprite
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private currentState: MiniMeState = 'idle'
  private blinkTimer: number = 0
  private isBlinking: boolean = false
  private eyeOpen: number = 1
  private time: number = 0
  private reminderKind: ReminderKind = 'drink_water'

  private readonly C = {
    skin: '#FFE8D6', skinShade: '#F0C8A0', skinDark: '#E0B088',
    body: '#C4B5FD', bodyShade: '#A78BFA', bodyDark: '#8B5CF6',
    white: '#FFFFFF', pupil: '#2D2D4A', shine: '#FFFFFF',
    blush: 'rgba(255,150,150,0.40)', mouth: '#E07070',
    shadow: 'rgba(0,0,0,0.08)',
  }

  constructor() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas = document.createElement('canvas')
    this.canvas.width = 512 * dpr
    this.canvas.height = 512 * dpr
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.scale(dpr, dpr)

    const tex = new THREE.CanvasTexture(this.canvas)
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })
    this.sprite = new THREE.Sprite(mat)
    this.sprite.scale.set(1.3, 1.3, 1)
    this.sprite.position.y = 0.28

    this.group = new THREE.Group()
    this.group.add(this.sprite)
    this.drawIdle()
  }

  setState(state: MiniMeState, reminderKind?: ReminderKind) {
    this.currentState = state
    if (reminderKind) this.reminderKind = reminderKind
  }
  getState(): MiniMeState { return this.currentState }

  update(dt: number, time: number) {
    this.time = time
    this.blinkTimer += dt
    if (this.isBlinking) {
      this.eyeOpen = Math.max(0, this.eyeOpen - dt * 30)
      if (this.eyeOpen <= 0.01) { this.isBlinking = false; this.blinkTimer = 0 }
    } else {
      this.eyeOpen = Math.min(1, this.eyeOpen + dt * 20)
      if (this.blinkTimer > 3 + Math.sin(time * 0.2) * 1.5) { this.isBlinking = true }
    }
    switch (this.currentState) {
      case 'idle': this.drawIdle(); break
      case 'typing': this.drawTyping(); break
      case 'thinking': this.drawThinking(); break
      case 'drink': this.drawDrink(); break
      case 'stretch': this.drawStretch(); break
      case 'sleepy': this.drawSleepy(); break
      case 'focus': this.drawFocus(); break
      case 'privacy': this.drawPrivacy(); break
      case 'reminding': this.drawReminding(); break
    }
    this.sprite.material.map!.needsUpdate = true
    this.group.position.y = 0.28 + Math.sin(time * 2.2) * 0.006
  }

  // ============== 工具 ==============
  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx; c.beginPath(); c.moveTo(x+r,y)
    c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
    c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r)
    c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

  // ============== 部件 ==============

  private drawShadow() {
    const c = this.ctx
    c.save()
    c.beginPath(); c.ellipse(256, 460, 110, 22, 0, 0, Math.PI*2)
    c.fillStyle = this.C.shadow; c.fill()
    c.beginPath(); c.ellipse(256, 462, 150, 16, 0, 0, Math.PI*2)
    c.fillStyle = 'rgba(0,0,0,0.04)'; c.fill()
    c.restore()
  }

  /** 软萌身体 — 圆润胶囊 */
  private drawBody(scaleY: number = 1) {
    const c = this.ctx
    c.save()
    c.translate(256, 400); c.scale(1, scaleY); c.translate(-256, -400)
    const g = c.createRadialGradient(240, 370, 20, 256, 410, 100)
    g.addColorStop(0, '#DDD6FE')
    g.addColorStop(0.5, this.C.body)
    g.addColorStop(1, this.C.bodyDark)
    this.rr(178, 310, 156, 180, 78)
    c.fillStyle = g; c.fill()
    // 底部高光
    c.beginPath(); c.ellipse(256, 380, 40, 15, 0, 0, Math.PI*2)
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill()
    c.restore()
  }

  /** 圆润大头 */
  private drawHead(tilt: number = 0) {
    const c = this.ctx
    c.save()
    c.translate(256, 180); c.rotate(tilt); c.translate(-256, -180)
    // 主圆 + 渐变
    c.beginPath(); c.arc(256, 180, 120, 0, Math.PI*2)
    const g = c.createRadialGradient(220, 140, 20, 256, 180, 120)
    g.addColorStop(0, '#FFF5EB')
    g.addColorStop(0.5, this.C.skin)
    g.addColorStop(1, this.C.skinDark)
    c.fillStyle = g; c.fill()
    // 头顶柔光
    c.beginPath(); c.arc(240, 140, 50, 0, Math.PI*2)
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill()
    c.restore()
  }

  /** ⭐ 超大眼睛 — Kawaii 灵魂 */
  private drawEyes(eo: number, lookUp: boolean = false, narrow: boolean = false) {
    const c = this.ctx; if (eo < 0.02) { this.drawClosedEyes(); return }
    c.save()
    const ey = lookUp ? -4 : 0
    const ew = narrow ? 32 : 34  // 眼宽
    const eh = 38 * eo            // 眼高
    const px = lookUp ? 0 : 2    // 瞳孔偏移
    const py = lookUp ? -4 : 2

    // ---- 左眼 ----
    c.beginPath(); c.ellipse(218, 178 + ey, ew, eh, 0, 0, Math.PI*2)
    c.fillStyle = this.C.white; c.fill()
    // 左瞳孔 (大)
    c.beginPath(); c.arc(220 + px, 182 + ey + py, 18 * eo, 0, Math.PI*2)
    c.fillStyle = this.C.pupil; c.fill()
    // 左瞳孔内圈 (渐变)
    c.beginPath(); c.arc(218 + px, 180 + ey + py, 10 * eo, 0, Math.PI*2)
    c.fillStyle = '#1a1a3a'; c.fill()
    // 左大高光 ⭐
    c.beginPath(); c.arc(210, 168 + ey, 6, 0, Math.PI*2)
    c.fillStyle = this.C.shine; c.fill()
    // 左小高光 ✨
    c.beginPath(); c.arc(228, 188 + ey, 3, 0, Math.PI*2)
    c.fillStyle = this.C.shine; c.fill()

    // ---- 右眼 ----
    c.beginPath(); c.ellipse(294, 178 + ey, ew, eh, 0, 0, Math.PI*2)
    c.fillStyle = this.C.white; c.fill()
    // 右瞳孔
    c.beginPath(); c.arc(296 + px, 182 + ey + py, 18 * eo, 0, Math.PI*2)
    c.fillStyle = this.C.pupil; c.fill()
    c.beginPath(); c.arc(294 + px, 180 + ey + py, 10 * eo, 0, Math.PI*2)
    c.fillStyle = '#1a1a3a'; c.fill()
    // 右大高光
    c.beginPath(); c.arc(286, 168 + ey, 6, 0, Math.PI*2)
    c.fillStyle = this.C.shine; c.fill()
    // 右小高光
    c.beginPath(); c.arc(304, 188 + ey, 3, 0, Math.PI*2)
    c.fillStyle = this.C.shine; c.fill()

    c.restore()
  }

  private drawClosedEyes() {
    const c = this.ctx; c.save()
    c.strokeStyle = this.C.skinDark; c.lineWidth = 3; c.lineCap = 'round'
    // 左闭眼 (弯弯的弧)
    c.beginPath(); c.arc(218, 178, 20, Math.PI*0.1, Math.PI*0.9)
    c.stroke()
    // 右闭眼
    c.beginPath(); c.arc(294, 178, 20, Math.PI*0.1, Math.PI*0.9)
    c.stroke()
    c.restore()
  }

  /** 😊 腮红 */
  private drawBlush() {
    const c = this.ctx; c.save()
    // 左腮红
    c.beginPath(); c.ellipse(170, 210, 28, 16, 0, 0, Math.PI*2)
    c.fillStyle = this.C.blush; c.fill()
    // 右腮红
    c.beginPath(); c.ellipse(342, 210, 28, 16, 0, 0, Math.PI*2)
    c.fillStyle = this.C.blush; c.fill()
    c.restore()
  }

  /** 微笑 — 小小弯弧 */
  private drawMouth(smile: number) {
    const c = this.ctx; c.save()
    const h = 6 + smile * 10
    c.beginPath()
    c.moveTo(236, 222 + h*0.1)
    c.quadraticCurveTo(256, 222 - h, 276, 222 + h*0.1)
    c.strokeStyle = this.C.mouth
    c.lineWidth = 3.5
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.stroke()
    c.restore()
  }

  /** 🦾 圆滚滚的手臂 */
  private drawArms(ly: number, ry: number) {
    const c = this.ctx; c.save()
    const by = 335
    // ---- 左臂 ----
    const lx = 140
    this.rr(lx, by + ly, 30, 90, 15)
    const g1 = c.createLinearGradient(lx, by+ly, lx+30, by+ly)
    g1.addColorStop(0, this.C.skinDark); g1.addColorStop(0.4, this.C.skin); g1.addColorStop(1, this.C.skin)
    c.fillStyle = g1; c.fill()
    // 左手
    c.beginPath(); c.arc(lx + 15, by + ly + 90, 15, 0, Math.PI*2)
    c.fillStyle = this.C.skin; c.fill()

    // ---- 右臂 ----
    const rx = 372
    this.rr(rx - 30, by + ry, 30, 90, 15)
    const g2 = c.createLinearGradient(rx-30, by+ry, rx, by+ry)
    g2.addColorStop(0, this.C.skin); g2.addColorStop(0.6, this.C.skin); g2.addColorStop(1, this.C.skinDark)
    c.fillStyle = g2; c.fill()
    c.beginPath(); c.arc(rx - 15, by + ry + 90, 15, 0, Math.PI*2)
    c.fillStyle = this.C.skin; c.fill()

    c.restore()
  }

  // ============== 道具 ==============

  private drawKeyboard() {
    const c = this.ctx; c.save()
    // 底座
    this.rr(190, 395, 132, 44, 14); c.fillStyle = '#2A2A3E'; c.fill()
    // 键位 4×3
    for (let r=0; r<3; r++) for (let col=0; col<4; col++) {
      if (r===2 && col!==1) continue
      const kx = 200 + col*28, ky = 400 + r*12
      this.rr(kx, ky, 22, 9, 4)
      const isAccent = (r===1&&col===1)||(r===2&&col===1)
      c.fillStyle = isAccent ? '#6EA8FF' : '#6B6B8A'
      c.globalAlpha = 0.5 + Math.sin(this.time+r+col)*0.3
      c.fill(); c.globalAlpha = 1
    }
    c.restore()
  }

  private drawCup() {
    const c = this.ctx; c.save()
    // 杯身
    this.rr(216, 340, 80, 70, 12)
    const g = c.createLinearGradient(216,340,296,340)
    g.addColorStop(0,'rgba(180,215,255,0.6)'); g.addColorStop(0.5,'rgba(210,235,255,0.8)'); g.addColorStop(1,'rgba(180,215,255,0.6)')
    c.fillStyle = g; c.fill()
    // 水面
    this.rr(222, 360, 68, 40, 8); c.fillStyle = 'rgba(130,200,255,0.4)'; c.fill()
    // 把手
    c.beginPath(); c.arc(300, 375, 20, -Math.PI/2, Math.PI/2)
    c.strokeStyle = 'rgba(180,215,255,0.5)'; c.lineWidth=5; c.lineCap='round'; c.stroke()
    c.restore()
  }

  private drawQuestionMark() {
    const c = this.ctx; c.save()
    // 跳动的小灯泡 — 表示"我有个想法" 💡
    const bounce = Math.sin(this.time * 3) * 5
    const cx = 380, cy = 85 + bounce
    // 灯泡光晕
    const glow = c.createRadialGradient(cx, cy - 5, 2, cx, cy, 24)
    glow.addColorStop(0, 'rgba(255,230,100,0.9)')
    glow.addColorStop(0.5, 'rgba(255,200,50,0.4)')
    glow.addColorStop(1, 'rgba(255,200,50,0)')
    c.beginPath(); c.arc(cx, cy, 24, 0, Math.PI * 2)
    c.fillStyle = glow; c.fill()
    // 灯泡主体
    c.beginPath(); c.arc(cx, cy - 3, 12, Math.PI, 0)
    c.quadraticCurveTo(cx + 12, cy + 2, cx, cy + 8)
    c.quadraticCurveTo(cx - 12, cy + 2, cx - 12, cy - 3)
    c.closePath()
    const bulbG = c.createRadialGradient(cx - 3, cy - 6, 2, cx, cy - 3, 12)
    bulbG.addColorStop(0, '#FFF8E0')
    bulbG.addColorStop(0.5, '#FFDD66')
    bulbG.addColorStop(1, '#EEBB33')
    c.fillStyle = bulbG; c.fill()
    // 灯泡底部
    c.fillRect(cx - 3, cy + 6, 6, 4)
    // 灯泡内发光线条
    c.beginPath(); c.moveTo(cx - 5, cy - 8); c.lineTo(cx - 2, cy - 5)
    c.moveTo(cx + 5, cy - 8); c.lineTo(cx + 2, cy - 5)
    c.moveTo(cx - 6, cy - 2); c.lineTo(cx - 3, cy - 1)
    c.moveTo(cx + 6, cy - 2); c.lineTo(cx + 3, cy - 1)
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.5
    c.stroke()
    c.restore()
  }

  private drawPillow() {
    const c = this.ctx; c.save()
    this.rr(180, 350, 152, 60, 24); c.fillStyle = '#C4D6FF'; c.fill()
    c.strokeStyle = '#A8C0EE'; c.lineWidth = 2; c.beginPath(); c.moveTo(210,380); c.lineTo(302,380); c.stroke()
    c.restore()
  }

  private drawHeadphones() {
    const c = this.ctx; c.save()
    c.beginPath(); c.arc(256, 110, 80, Math.PI*1.2, Math.PI*1.8)
    c.strokeStyle = '#444466'; c.lineWidth=8; c.lineCap='round'; c.stroke()
    c.beginPath(); c.ellipse(172, 145, 14, 24, 0, 0, Math.PI*2)
    c.fillStyle = '#6EA8FF'; c.fill()
    c.beginPath(); c.ellipse(340, 145, 14, 24, 0, 0, Math.PI*2)
    c.fillStyle = '#6EA8FF'; c.fill()
    c.restore()
  }

  // ============== 各状态 ==============

  private drawIdle() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow(); this.drawBody()
    const sw = Math.sin(this.time*1.2)*4
    this.drawArms(sw, -sw); this.drawHead(); this.drawBlush()
    this.drawEyes(this.eyeOpen); this.drawMouth(0.7)
  }

  private drawTyping() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow(); this.drawBody()
    const tap = Math.sin(this.time*14)*12
    this.drawArms(tap-15, -tap-15)
    this.drawHead(0.04); this.drawBlush()
    this.drawEyes(this.eyeOpen, false, true); this.drawMouth(0.6)
    this.drawKeyboard()
    // 小粒子
    c.save()
    for (let i=0; i<6; i++) {
      const px = 200 + Math.sin(this.time*2+i*1.5)*50
      const py = 280 + Math.sin(this.time*3+i*2)*35
      c.globalAlpha = Math.max(0, Math.sin(this.time*2+i*1.2))*0.5
      c.fillStyle = ['#6EA8FF','#FFAA44','#4ADE80','#F87171','#C084FC','#ffffff'][i]
      c.fillRect(px, py, 6, 6)
    }
    c.restore()
  }

  private drawThinking() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow(); this.drawBody(); this.drawArms(0,0)
    this.drawHead(0.08); this.drawBlush()
    this.drawEyes(this.eyeOpen, true); this.drawMouth(0.3)
    this.drawQuestionMark()
  }

  private drawDrink() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow(); this.drawBody(); this.drawArms(-50,-50)
    this.drawHead(-0.05); this.drawBlush()
    this.drawEyes(this.eyeOpen); this.drawMouth(0.5)
    this.drawCup()
  }

  private drawStretch() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow()
    c.save(); c.translate(256, 400); c.scale(1,1.2); c.translate(-256, -400)
    this.drawBody(); c.restore()
    this.drawArms(-120,-120); this.drawHead(0.1); this.drawBlush()
    this.drawEyes(0.2)
    c.save(); c.beginPath(); c.ellipse(256, 230, 14, 18, 0, 0, Math.PI*2)
    c.fillStyle = '#2D2D4A'; c.fill(); c.restore()
  }

  private drawSleepy() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow()
    c.save(); c.translate(256, 400); c.rotate(0.06); c.scale(1,0.92); c.translate(-256, -400)
    this.drawBody(); c.restore()
    this.drawPillow(); this.drawArms(5,5)
    c.save(); c.translate(256, 180); c.rotate(0.08); c.translate(-256, -180)
    this.drawHead(); this.drawEyes(0.05); this.drawMouth(0)
    c.restore()
    c.save(); c.font='32px sans-serif'; c.fillStyle='#A78BFA'; c.fillText('💤', 350, 90); c.restore()
  }

  private drawFocus() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow(); this.drawBody(); this.drawArms(0,0)
    this.drawHead(); this.drawBlush()
    this.drawEyes(this.eyeOpen, false, true); this.drawMouth(0.4)
    this.drawHeadphones()
  }

  private drawReminding() {
    const c = this.ctx; c.clearRect(0,0,512,512)
    this.drawShadow(); this.drawBody()

    switch (this.reminderKind) {
      case 'drink_water':
        // 双手捧杯 + 担心表情
        this.drawArms(-40, -40)
        this.drawHead(-0.03); this.drawBlush()
        this.drawEyes(this.eyeOpen); this.drawMouth(0.2)
        this.drawCup()
        c.save()
        // 冒出小水滴提示
        c.font = '28px sans-serif'; c.textAlign = 'center'
        c.fillStyle = '#60B0FF'
        c.fillText('💧', 390, 140)
        c.restore()
        break

      case 'stand_up':
        // 伸懒腰 + 指腿
        this.drawArms(-30, 30)
        this.drawHead(0.08); this.drawBlush()
        this.drawEyes(this.eyeOpen, false, true); this.drawMouth(0.1)
        c.save()
        c.font = '32px sans-serif'; c.textAlign = 'center'
        c.fillStyle = '#FFAA44'
        c.fillText('🦵', 390, 150)
        c.restore()
        break

      case 'late_night':
        // 打哈欠 + 指时钟
        this.drawArms(20, -20)
        this.drawHead(0.12); this.drawBlush()
        this.drawEyes(0.15); this.drawMouth(0)
        c.save(); c.beginPath(); c.ellipse(256, 230, 12, 16, 0, 0, Math.PI*2)
        c.fillStyle = '#2D2D4A'; c.fill(); c.restore()
        c.save()
        c.font = '32px sans-serif'; c.textAlign = 'center'
        c.fillStyle = '#818CF8'
        c.fillText('🌙', 390, 130)
        c.restore()
        break

      case 'eye_rest':
        // 揉眼睛姿势
        this.drawArms(-10, -10)
        this.drawHead(0.05); this.drawBlush()
        this.drawEyes(0.3); this.drawMouth(0.15)
        c.save()
        c.font = '28px sans-serif'; c.textAlign = 'center'
        c.fillStyle = '#34D399'
        c.fillText('👀', 390, 140)
        c.restore()
        break
    }
  }
}
