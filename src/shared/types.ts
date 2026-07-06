// ============================================================
// minime - 共享类型定义
// ============================================================

/** 角色状态 */
export enum MinimeState {
  Idle = 'idle',
  Typing = 'typing',
  Thinking = 'thinking',
  Reminding = 'reminding',
  Sleeping = 'sleeping',
  Walking = 'walking',
}

/** 角色状态元信息 */
export interface StateConfig {
  state: MinimeState
  label: string
  duration: number        // 最短持续时间(ms)
  priority: number        // 优先级(数字越大越优先)
  canInterrupt: boolean   // 是否可被更高优先级打断
}

/** 传感器数据 - 从主进程发送到渲染进程 */
export interface SensorData {
  keyboardActivity: number   // 0-1 键盘活跃度
  mouseActivity: number      // 0-1 鼠标活跃度
  typingSpeed: number        // 打字速度(键/秒)
  isActive: boolean          // 是否有任何输入活动
  idleTime: number           // 空闲时间(ms)
  foregroundApp: string      // 前台窗口标题
  mousePosition: { x: number; y: number }
  timestamp: number
}

/** 提醒类型 */
export enum ReminderType {
  DrinkWater = 'drink_water',
  StandUp = 'stand_up',
  LateNight = 'late_night',
  EyeRest = 'eye_rest',
}

/** 提醒事件 */
export interface ReminderEvent {
  type: ReminderType
  message: string
  timestamp: number
  level: 'info' | 'warning' | 'urgent'
}

/** IPC 通道名称 */
export const IPC_CHANNELS = {
  SENSOR_DATA: 'sensor:data',
  REMINDER_ACTION: 'reminder:action',
  REMINDER_TRIGGER: 'reminder:trigger',
  DAILY_STATS: 'stats:daily',
  WINDOW_CONTROL: 'window:control',
  SCREEN_FRAME: 'screen:frame',
  ICON_DATA: 'icon:data',
} as const

/** 每日统计数据 */
export interface DailyStats {
  date: string
  totalTypingMinutes: number
  totalActiveMinutes: number
  remindersCompleted: number
  remindersSnoozed: number
  longestIdleMinutes: number
  activeHours: number[]
  waterIntake: number
  focusSessions: number
}
