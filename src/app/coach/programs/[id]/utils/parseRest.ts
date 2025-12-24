/**
 * Parse a rest time string into seconds.
 *
 * Supports formats:
 * - "30s" → 30
 * - "2m" → 120
 * - "1m30s" → 90
 * - "90" → 90 (plain number assumed to be seconds)
 *
 * Returns null for empty or invalid input.
 */
export function parseRestInput(val: string): number | null {
  const v = val.toLowerCase().trim()
  if (!v) return null

  const mMatch = v.match(/(\d+)m/)
  const sMatch = v.match(/(\d+)s/)
  const pureNum = v.match(/^(\d+)$/)

  let totalSeconds = 0
  if (mMatch) totalSeconds += Number(mMatch[1]) * 60
  if (sMatch) totalSeconds += Number(sMatch[1])
  if (pureNum && !mMatch && !sMatch) totalSeconds = Number(pureNum[1])

  return totalSeconds || null
}

/**
 * Format seconds into a human-readable rest time string.
 *
 * Examples:
 * - 30 → "30s"
 * - 120 → "2m"
 * - 90 → "1m30s"
 */
export function formatRestTime(seconds: number | null): string {
  if (!seconds) return ''
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}
