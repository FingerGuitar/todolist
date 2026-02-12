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
