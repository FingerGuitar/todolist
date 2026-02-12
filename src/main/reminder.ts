import { Notification, BrowserWindow } from 'electron'
import { getDb } from './database'
import { tasks } from '../shared/schema'
import { and, lte, gte, eq, lt } from 'drizzle-orm'
import { STATUS } from '../shared/types'
import { formatLocalDateTime, formatLocalDate } from '../shared/date-utils'

let intervalId: ReturnType<typeof setInterval> | null = null

export function startReminderScheduler(): void {
  // Check every 60 seconds for tasks with due reminders
  checkReminders()
  intervalId = setInterval(checkReminders, 60 * 1000)
}

export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function checkReminders(): void {
  try {
    const db = getDb()
    const now = formatLocalDateTime()
    const fiveMinutesFromNow = formatLocalDateTime(new Date(Date.now() + 5 * 60 * 1000))

    // Find tasks with reminderAt within the next 5 minutes that are not completed
    const dueTasks = db
      .select()
      .from(tasks)
      .where(
        and(
          lte(tasks.reminderAt, fiveMinutesFromNow),
          gte(tasks.reminderAt, now),
          eq(tasks.status, STATUS.TODO)
        )
      )
      .all()

    for (const task of dueTasks) {
      showNotification(task.title, task.reminderAt!)
      // Clear the reminder so it doesn't fire again
      db.update(tasks)
        .set({ reminderAt: null })
        .where(eq(tasks.id, task.id))
        .run()
    }

    // Also check for overdue tasks (dueDate strictly before today, still TODO)
    const today = formatLocalDate()
    const overdueTasks = db
      .select()
      .from(tasks)
      .where(
        and(
          lt(tasks.dueDate, today),
          eq(tasks.status, STATUS.TODO)
        )
      )
      .all()

    if (overdueTasks.length > 0) {
      // Only notify once per hour about overdue tasks
      const lastNotified = (global as Record<string, unknown>).__lastOverdueNotify as number | undefined
      if (!lastNotified || Date.now() - lastNotified > 60 * 60 * 1000) {
        showNotification(
          `${overdueTasks.length} 个任务已逾期`,
          undefined,
          '请及时处理逾期任务'
        )
        ;(global as Record<string, unknown>).__lastOverdueNotify = Date.now()
      }
    }
  } catch {
    // Silently ignore errors in reminder scheduler
  }
}

function showNotification(title: string, _reminderAt?: string, body?: string): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: 'TodoList 提醒',
    body: body ?? `任务「${title}」即将到期`,
    silent: false
  })
  notification.on('click', () => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) {
      wins[0].show()
      wins[0].focus()
    }
  })
  notification.show()
}
