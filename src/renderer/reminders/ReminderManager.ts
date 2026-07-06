import { ReminderType, ReminderEvent, SensorData, MinimeState, MinimeSettings } from '../../shared/types'
import { StateMachine } from '../states/StateMachine'
import { ReminderKind } from '../character/MiniMeAvatar'

// ============================================================
// 提醒管理器 - 情绪化喝水、久坐、熬夜提醒
// ============================================================

export type ReminderCallback = (event: ReminderEvent) => void
export type ReminderDismissCallback = () => void

const REMINDER_MESSAGES = {
  [ReminderType.DrinkWater]: {
    first: '💧 我喝了一口水，你呢？',
    second: '🥤 你还没喝水！来看看我的水杯',
    third: '🌵 再不喝水我要变成仙人掌了...',
  },
  [ReminderType.StandUp]: {
    first: '🪑 我的腿都坐麻了...你要不要站一下？',
    second: '🏃 站起来！我们一起做拉伸！',
    third: '💀 你再不站，我就从椅子上滑下去了',
  },
  [ReminderType.LateNight]: {
    first: '🌙 这么晚了，还在工作吗？',
    second: '🛏️ 我睡衣都换好了...',
    third: '😴 你确定还要继续？我担心你明天的状态',
  },
  [ReminderType.EyeRest]: {
    first: '👀 盯屏幕好久了，看远处20秒？',
    second: '🔭 我拿望远镜帮你看看远处',
    third: '😵 你的眼睛在抗议了...',
  },
}

export class ReminderManager {
  private stateMachine: StateMachine
  private onReminder: ReminderCallback | null = null
  private onDismiss: ReminderDismissCallback | null = null
  private activeReminder: ReminderType | null = null
  private reminderLevel: number = 0

  // 提醒间隔 (ms) - 默认值将由设置覆盖
  private drinkInterval = 45 * 60 * 1000
  private standInterval = 60 * 60 * 1000
  private eyeRestInterval = 30 * 60 * 1000

  // 上次提醒时间戳
  private lastDrinkTime: number = Date.now()
  private lastStandTime: number = Date.now()
  private lastEyeRestTime: number = Date.now()

  constructor(stateMachine: StateMachine) {
    this.stateMachine = stateMachine
  }

  /** 从设置更新间隔 */
  updateSettings(settings: MinimeSettings) {
    this.drinkInterval = settings.drinkInterval * 60 * 1000
    this.standInterval = settings.standInterval * 60 * 1000
    this.eyeRestInterval = settings.eyeRestInterval * 60 * 1000
    console.log(`[ReminderManager] 间隔已更新: 喝水=${settings.drinkInterval}min, 久坐=${settings.standInterval}min, 远眺=${settings.eyeRestInterval}min`)
  }

  setCallbacks(onReminder: ReminderCallback, onDismiss: ReminderDismissCallback) {
    this.onReminder = onReminder
    this.onDismiss = onDismiss
  }

  /** 每帧检查是否需要触发提醒 */
  update(sensorData: SensorData) {
    if (this.activeReminder) return // 已有提醒进行中

    const now = Date.now()

    // 喝水提醒
    if (now - this.lastDrinkTime > this.drinkInterval) {
      this.triggerReminder(ReminderType.DrinkWater)
      return
    }

    // 久坐提醒
    if (now - this.lastStandTime > this.standInterval) {
      this.triggerReminder(ReminderType.StandUp)
      return
    }

    // 远眺提醒
    if (now - this.lastEyeRestTime > this.eyeRestInterval) {
      this.triggerReminder(ReminderType.EyeRest)
      return
    }
  }

  private triggerReminder(type: ReminderType) {
    this.activeReminder = type
    this.reminderLevel = 0
    const messages = REMINDER_MESSAGES[type]

    const event: ReminderEvent = {
      type,
      message: messages.first,
      timestamp: Date.now(),
      level: 'info',
    }

    // 强制角色进入提醒状态（传递提醒类型用于情绪化表现）
    this.stateMachine.forceReminding(type as unknown as ReminderKind)
    this.onReminder?.(event)
  }

  /** 用户在提醒后选择了完成 */
  completeReminder() {
    if (!this.activeReminder) return

    switch (this.activeReminder) {
      case ReminderType.DrinkWater:
        this.lastDrinkTime = Date.now()
        break
      case ReminderType.StandUp:
        this.lastStandTime = Date.now()
        break
      case ReminderType.EyeRest:
        this.lastEyeRestTime = Date.now()
        break
      case ReminderType.LateNight:
        this.lastStandTime = Date.now()
        break
    }

    this.stateMachine.exitReminding()
    this.activeReminder = null
    this.reminderLevel = 0
    this.onDismiss?.()
  }

  /** 用户忽略了提醒，下次升级 */
  snoozeReminder() {
    if (!this.activeReminder) return

    this.reminderLevel++
    const messages = REMINDER_MESSAGES[this.activeReminder]
    const messageKey = ['first', 'second', 'third'][Math.min(this.reminderLevel, 2)] as keyof typeof messages
    const message = messages[messageKey]

    const event: ReminderEvent = {
      type: this.activeReminder,
      message,
      timestamp: Date.now(),
      level: this.reminderLevel >= 2 ? 'urgent' : 'warning',
    }

    this.stateMachine.forceReminding(this.activeReminder as unknown as ReminderKind)
    this.onReminder?.(event)
  }

  /** 重置所有提醒计时器 */
  resetAll() {
    const now = Date.now()
    this.lastDrinkTime = now
    this.lastStandTime = now
    this.lastEyeRestTime = now
  }
}
