import * as fs from 'fs'
import * as path from 'path'
import { DailyStats as DailyStatsType } from '../../shared/types'
import { app } from 'electron'

// ============================================================
// 每日数据统计
// ============================================================

const STATS_FILE = path.join(app.getPath('userData'), 'minime-stats.json')

export class DailyStats {
  private data: DailyStatsType
  private lastActiveTime: number = Date.now()
  private longestIdle: number = 0

  constructor() {
    this.data = this.load()
    this.resetIfNewDay()
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0]
  }

  private resetIfNewDay() {
    if (this.data.date !== this.getTodayKey()) {
      this.data = this.createEmpty()
      this.save()
    }
  }

  private createEmpty(): DailyStatsType {
    return {
      date: this.getTodayKey(),
      totalTypingMinutes: 0,
      totalActiveMinutes: 0,
      remindersCompleted: 0,
      remindersSnoozed: 0,
      longestIdleMinutes: 0,
      activeHours: new Array(24).fill(0),
      waterIntake: 0,
      focusSessions: 0,
    }
  }

  private load(): DailyStatsType {
    try {
      if (fs.existsSync(STATS_FILE)) {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'))
      }
    } catch { /* ignore */ }
    return this.createEmpty()
  }

  save() {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2))
    } catch { /* ignore */ }
  }

  // 记录活跃分钟
  recordActive(minutes: number) {
    this.data.totalActiveMinutes += minutes
    const hour = new Date().getHours()
    this.data.activeHours[hour] = (this.data.activeHours[hour] || 0) + minutes
    this.save()
  }

  // 记录打字分钟
  recordTyping(minutes: number) {
    this.data.totalTypingMinutes += minutes
    this.save()
  }

  // 记录空闲时间
  recordIdle(minutes: number) {
    if (minutes > this.data.longestIdleMinutes) {
      this.data.longestIdleMinutes = minutes
      this.save()
    }
  }

  // 记录喝水
  recordWater() {
    this.data.waterIntake++
    this.save()
  }

  // 记录提醒完成
  recordReminderCompleted() {
    this.data.remindersCompleted++
    this.save()
  }

  // 记录提醒忽略
  recordReminderSnoozed() {
    this.data.remindersSnoozed++
    this.save()
  }

  // 记录专注会话
  recordFocusSession() {
    this.data.focusSessions++
    this.save()
  }

  getSummary(): DailyStatsType {
    this.resetIfNewDay()
    return { ...this.data }
  }
}
