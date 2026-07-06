import * as THREE from 'three'
import { MiniMeAvatar, MiniMeState, ReminderKind } from './MiniMeAvatar'

// ============================================================
// Character3D — 适配器：接入 MiniMeAvatar Q版小人
// 保留旧接口兼容状态机
// ============================================================

export interface JointAngles {
  headTilt: number; headTurn: number
  leftArmRaise: number; leftArmSwing: number
  rightArmRaise: number; rightArmSwing: number
  leftElbowBend: number; rightElbowBend: number
  leftForearmTwist: number; rightForearmTwist: number
  leftLegRaise: number; rightLegRaise: number
  bodyLean: number; bodySway: number
}
const DEFAULT_IDLE: JointAngles = {
  headTilt:0, headTurn:0, leftArmRaise:-0.3, leftArmSwing:0,
  rightArmRaise:-0.3, rightArmSwing:0, leftElbowBend:0.2, rightElbowBend:0.2,
  leftForearmTwist:0, rightForearmTwist:0, leftLegRaise:0, rightLegRaise:0,
  bodyLean:0, bodySway:0,
}

export class Character3D {
  public group: THREE.Group
  public joints: { [key: string]: THREE.Object3D } = {}
  private avatar!: MiniMeAvatar
  private sittingPose = true
  public targetAngles: JointAngles = { ...DEFAULT_IDLE }
  public currentAngles: JointAngles = { ...DEFAULT_IDLE }
  private isTyping = false; private isThinking = false; private isSleeping = false

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.avatar = new MiniMeAvatar()
    this.avatar.group.position.y = 0
    this.group.add(this.avatar.group)
    scene.add(this.group)
    this.setSitting(true)
  }

  setMiniMeState(state: MiniMeState) { this.avatar.setState(state) }

  setSitting(sitting: boolean) { this.sittingPose = sitting; if (sitting) this.setIdle() }

  setIdle() { this.isTyping=false; this.isThinking=false; this.isSleeping=false; this.avatar.setState('idle') }
  setTyping() { this.isTyping=true; this.isThinking=false; this.isSleeping=false; this.avatar.setState('typing') }
  setThinking() { this.isTyping=false; this.isThinking=true; this.isSleeping=false; this.avatar.setState('thinking') }
  setReminding(kind?: ReminderKind) {
    this.isTyping=false; this.isThinking=false; this.isSleeping=false
    this.avatar.setState('reminding', kind)
  }
  setSleeping() { this.isTyping=false; this.isThinking=false; this.isSleeping=true; this.avatar.setState('sleepy') }
  setWalking() { this.isTyping=false; this.isThinking=false; this.isSleeping=false; this.avatar.setState('idle') }
  setPropsVisible(_v: boolean) {}
  setMonitorTexture(_d: string) {}

  update(deltaTime: number, time: number) {
    this.avatar.update(Math.min(deltaTime, 0.1), time)
  }

  dispose() {
    this.group.traverse(c => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose()
        const m = c.material
        if (Array.isArray(m)) m.forEach(m2 => m2.dispose())
        else m.dispose()
      }
    })
  }
}
