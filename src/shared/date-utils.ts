/**
 * Shared date formatting utilities.
 *
 * Convention:
 *   - dueDate: stored as 'YYYY-MM-DD' (date only, local)
 *   - reminderAt / createdAt / updatedAt / completedAt: 'YYYY-MM-DD HH:MM:SS' (local)
 *   - SQLite default values also use datetime('now','localtime') → same format
 */

const pad = (n: number): string => String(n).padStart(2, '0')

/** Format a Date as 'YYYY-MM-DD HH:MM:SS' in local time */
export function formatLocalDateTime(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** Format a Date as 'YYYY-MM-DD' in local time */
export function formatLocalDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Format duration between two datetime strings as human-readable */
export function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '0分钟'

  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const remainHours = hours % 24
  const remainMinutes = minutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (remainHours > 0) parts.push(`${remainHours}小时`)
  if (remainMinutes > 0 || parts.length === 0) parts.push(`${remainMinutes}分钟`)

  return parts.join('')
}
