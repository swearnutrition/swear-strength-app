import { describe, it, expect } from 'vitest'
import { parseRestInput, formatRestTime } from '../utils/parseRest'

describe('parseRestInput', () => {
  it('parses seconds format "30s" to 30', () => {
    expect(parseRestInput('30s')).toBe(30)
  })

  it('parses minutes format "2m" to 120', () => {
    expect(parseRestInput('2m')).toBe(120)
  })

  it('parses combined format "1m30s" to 90', () => {
    expect(parseRestInput('1m30s')).toBe(90)
  })

  it('parses combined format with space "1m 30s" to 90', () => {
    expect(parseRestInput('1m 30s')).toBe(90)
  })

  it('parses plain number "90" to 90', () => {
    expect(parseRestInput('90')).toBe(90)
  })

  it('parses "0" to null (falsy)', () => {
    expect(parseRestInput('0')).toBe(null)
  })

  it('returns null for empty string', () => {
    expect(parseRestInput('')).toBe(null)
  })

  it('returns null for whitespace only', () => {
    expect(parseRestInput('   ')).toBe(null)
  })

  it('is case insensitive', () => {
    expect(parseRestInput('2M')).toBe(120)
    expect(parseRestInput('30S')).toBe(30)
    expect(parseRestInput('1M30S')).toBe(90)
  })

  it('handles leading/trailing whitespace', () => {
    expect(parseRestInput('  30s  ')).toBe(30)
  })

  it('returns null for invalid input without numbers', () => {
    expect(parseRestInput('abc')).toBe(null)
  })
})

describe('formatRestTime', () => {
  it('formats 30 seconds as "30s"', () => {
    expect(formatRestTime(30)).toBe('30s')
  })

  it('formats 120 seconds as "2m"', () => {
    expect(formatRestTime(120)).toBe('2m')
  })

  it('formats 90 seconds as "1m30s"', () => {
    expect(formatRestTime(90)).toBe('1m30s')
  })

  it('formats 60 seconds as "1m"', () => {
    expect(formatRestTime(60)).toBe('1m')
  })

  it('returns empty string for null', () => {
    expect(formatRestTime(null)).toBe('')
  })

  it('returns empty string for 0', () => {
    expect(formatRestTime(0)).toBe('')
  })
})
