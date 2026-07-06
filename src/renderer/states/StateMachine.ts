import { MinimeState, SensorData, ReminderType } from '../../shared/types'
import { STATE_CONFIGS, STATE_RULES } from './states'
import { Character3D } from '../character/Character3D'
import { ReminderKind } from '../character/MiniMeAvatar'

// ============================================================
// 状态机 - 管理角色状态切换
// ============================================================

export type StateChangeCallback = (newState: MinimeState, oldState: MinimeState) => void

export class StateMachine {
  public currentState: MinimeState = MinimeState.Idle
  private previousState: MinimeState = MinimeState.Idle
  private stateEnterTime: number = Date.now()
  private listeners: StateChangeCallback[] = []
  private character: Character3D

  constructor(character: Character3D) {
    this.character = character
  }

  onStateChange(cb: StateChangeCallback) {
    this.listeners.push(cb)
  }

  /** 根据传感器数据更新状态 */
  update(sensorData: SensorData) {
    // 先检查提醒状态 - 提醒不能被其他状态打断
    if (this.currentState === MinimeState.Reminding) {
      return // 保持提醒状态
    }

    const now = Date.now()
    const elapsed = now - this.stateEnterTime
    const config = STATE_CONFIGS[this.currentState]

    // 检查是否满足最小持续时间
    if (elapsed < config.duration) {
      return
    }

    // 检查是否有更高优先级的状态需要切换
    const nextState = this.evaluateRules(sensorData)
    if (nextState !== null && nextState !== this.currentState) {
      this.transitionTo(nextState)
      return
    }

    // 如果没有匹配规则，回到 Idle
    if (this.currentState !== MinimeState.Idle && !sensorData.isActive) {
      this.transitionTo(MinimeState.Idle)
    }
  }

  private evaluateRules(sensorData: SensorData): MinimeState | null {
    let bestState: MinimeState | null = null
    let bestPriority = -1

    for (const rule of STATE_RULES) {
      const config = STATE_CONFIGS[rule.targetState]
      if (rule.condition(sensorData) && config.priority > bestPriority) {
        // 检查当前状态是否允许被这个优先级打断
        const currentConfig = STATE_CONFIGS[this.currentState]
        if (currentConfig.canInterrupt || config.priority > currentConfig.priority) {
          bestState = rule.targetState
          bestPriority = config.priority
        }
      }
    }

    return bestState
  }

  private transitionTo(newState: MinimeState) {
    this.previousState = this.currentState
    this.currentState = newState
    this.stateEnterTime = Date.now()

    // 坐/站切换: 默认坐着, 睡觉/走动时才站起来
    switch (newState) {
      case MinimeState.Sleeping:
        this.character.setSitting(true)
        this.character.setSleeping()
        break
      case MinimeState.Walking:
        this.character.setSitting(false)
        this.character.setWalking()
        break
      case MinimeState.Idle:
        this.character.setSitting(true)
        this.character.setIdle()
        break
      case MinimeState.Typing:
        this.character.setSitting(true)
        this.character.setTyping()
        break
      case MinimeState.Thinking:
        this.character.setSitting(true)
        this.character.setThinking()
        break
      case MinimeState.Reminding:
        this.character.setSitting(true)
        this.character.setReminding(this.currentReminderKind)
        break
    }
    switch (newState) {
      case MinimeState.Idle: break // 已在上面设置
      case MinimeState.Typing: this.character.setTyping(); break
      case MinimeState.Thinking: this.character.setThinking(); break
      case MinimeState.Reminding: this.character.setReminding(); break
      case MinimeState.Sleeping: break
      case MinimeState.Walking: break
    }

    // 通知监听器
    for (const cb of this.listeners) {
      cb(newState, this.previousState)
    }
  }

  /** 强制切换到提醒状态 */
  private currentReminderKind: ReminderKind = 'drink_water'

  forceReminding(kind?: ReminderKind) {
    if (kind) this.currentReminderKind = kind
    this.transitionTo(MinimeState.Reminding)
  }

  /** 退出提醒状态 */
  exitReminding() {
    this.transitionTo(MinimeState.Idle)
  }

  getStateDuration(): number {
    return Date.now() - this.stateEnterTime
  }
}
