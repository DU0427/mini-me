import { MinimeState, StateConfig } from '../../shared/types'

// ============================================================
// 状态定义
// ============================================================

export const STATE_CONFIGS: Record<MinimeState, StateConfig> = {
  [MinimeState.Idle]: {
    state: MinimeState.Idle,
    label: '待机',
    duration: 2000,
    priority: 0,
    canInterrupt: true,
  },
  [MinimeState.Typing]: {
    state: MinimeState.Typing,
    label: '打字中',
    duration: 500,
    priority: 2,
    canInterrupt: true,
  },
  [MinimeState.Thinking]: {
    state: MinimeState.Thinking,
    label: '思考中',
    duration: 3000,
    priority: 1,
    canInterrupt: true,
  },
  [MinimeState.Reminding]: {
    state: MinimeState.Reminding,
    label: '提醒中',
    duration: 5000,
    priority: 5,
    canInterrupt: false,
  },
  [MinimeState.Sleeping]: {
    state: MinimeState.Sleeping,
    label: '睡眠中',
    duration: Infinity,
    priority: 0,
    canInterrupt: true,
  },
  [MinimeState.Walking]: {
    state: MinimeState.Walking,
    label: '走动',
    duration: 1500,
    priority: 1,
    canInterrupt: true,
  },
}

/** 传感器数据 → 状态的映射规则 */
export interface StateRule {
  targetState: MinimeState
  condition: (sensorData: {
    keyboardActivity: number
    mouseActivity: number
    typingSpeed: number
    isActive: boolean
    idleTime: number
  }) => boolean
}

export const STATE_RULES: StateRule[] = [
  // 打字中: 键盘活跃且速度 > 2 键/秒
  {
    targetState: MinimeState.Typing,
    condition: (d) => d.isActive && d.typingSpeed > 2,
  },
  // 思考中: 有活动但打字慢或只有鼠标
  {
    targetState: MinimeState.Thinking,
    condition: (d) => d.isActive && d.typingSpeed <= 2 && d.idleTime < 10000,
  },
  // 睡眠: 空闲超过 5 分钟
  {
    targetState: MinimeState.Sleeping,
    condition: (d) => d.idleTime > 300000, // 5min
  },
  // Idle: 空闲 30s-5min
  {
    targetState: MinimeState.Idle,
    condition: (d) => d.idleTime > 30000 && d.idleTime <= 300000,
  },
]
