import { describe, it, expect } from 'vitest'
import { parseProgram, getUniqueExerciseNames } from '../importParser'

describe('importParser', () => {
  describe('parseProgram', () => {
    it('parses a basic program header', () => {
      const input = `PROGRAM: Test Program
TYPE: strength
DESCRIPTION: A test program

[WEEK 1]

[DAY 1] Push Day
[STRENGTH]
A1. Bench Press | 3x10 | Rest: 60s | RPE: 7`

      const result = parseProgram(input)

      expect(result.name).toBe('Test Program')
      expect(result.type).toBe('strength')
      expect(result.description).toBe('A test program')
      expect(result.is_indefinite).toBe(false)
      expect(result.errors).toHaveLength(0)
    })

    it('parses indefinite flag', () => {
      const input = `PROGRAM: Rolling Program
TYPE: mobility
INDEFINITE: yes

[WEEK 1]

[DAY 1] Day One
[STRENGTH]
A1. Stretch | 1x30s`

      const result = parseProgram(input)

      expect(result.is_indefinite).toBe(true)
      expect(result.type).toBe('mobility')
    })

    it('parses weeks and days', () => {
      const input = `PROGRAM: Test
TYPE: strength

[WEEK 1]

[DAY 1] Push
[STRENGTH]
A1. Bench | 3x10

[DAY 2] Pull
[STRENGTH]
A1. Row | 3x10`

      const result = parseProgram(input)

      expect(result.weeks).toHaveLength(1)
      expect(result.weeks[0].days).toHaveLength(2)
      expect(result.weeks[0].days[0].name).toBe('Push')
      expect(result.weeks[0].days[1].name).toBe('Pull')
    })

    it('parses week ranges', () => {
      const input = `PROGRAM: Test
TYPE: strength

[WEEKS 1-3]

[DAY 1] Workout
[STRENGTH]
A1. Squat | 3x10`

      const result = parseProgram(input)

      expect(result.weeks).toHaveLength(1)
      expect(result.weeks[0].weekNumbers).toEqual([1, 2, 3])
    })

    it('parses exercise sections', () => {
      const input = `PROGRAM: Test
TYPE: strength

[WEEK 1]

[DAY 1] Full Body
[WARMUP]
A1. Arm Circles | 1x10
[STRENGTH]
A1. Squat | 3x10
[COOLDOWN]
A1. Stretch | 1x30s`

      const result = parseProgram(input)
      const exercises = result.weeks[0].days[0].exercises

      expect(exercises).toHaveLength(3)
      expect(exercises[0].section).toBe('warmup')
      expect(exercises[1].section).toBe('strength')
      expect(exercises[2].section).toBe('cooldown')
    })

    it('parses exercise details', () => {
      const input = `PROGRAM: Test
TYPE: strength

[WEEK 1]

[DAY 1] Day
[STRENGTH]
A1. Bench Press | 3x10 | Rest: 90s | RPE: 8 | Note: Control the descent
B1. Squat | 4x8-10 per side | Rest: 120s`

      const result = parseProgram(input)
      const exercises = result.weeks[0].days[0].exercises

      expect(exercises[0].label).toBe('A1')
      expect(exercises[0].name).toBe('Bench Press')
      expect(exercises[0].sets).toBe('3')
      expect(exercises[0].reps).toBe('10')
      expect(exercises[0].restSeconds).toBe(90)
      expect(exercises[0].rpe).toBe(8)
      expect(exercises[0].notes).toBe('Control the descent')

      expect(exercises[1].label).toBe('B1')
      expect(exercises[1].sets).toBe('4')
      expect(exercises[1].reps).toBe('8-10 per side')
      expect(exercises[1].restSeconds).toBe(120)
    })

    it('parses rest days', () => {
      const input = `PROGRAM: Test
TYPE: strength

[WEEK 1]

[DAY 1] Rest Day
[REST]
Light walking or mobility work.`

      const result = parseProgram(input)
      const day = result.weeks[0].days[0]

      expect(day.isRestDay).toBe(true)
      expect(day.restDayNotes).toBe('Light walking or mobility work.')
    })

    it('parses duration-based reps', () => {
      const input = `PROGRAM: Test
TYPE: mobility

[WEEK 1]

[DAY 1] Stretch
[STRENGTH]
A1. Plank | 3x30s
A2. Hold | 2x1min`

      const result = parseProgram(input)
      const exercises = result.weeks[0].days[0].exercises

      expect(exercises[0].reps).toBe('30s')
      expect(exercises[1].reps).toBe('1min')
    })

    it('returns errors for missing program header', () => {
      const input = `[WEEK 1]
[DAY 1] Test
[STRENGTH]
A1. Exercise | 3x10`

      const result = parseProgram(input)

      expect(result.errors.some(e => e.message.includes('PROGRAM'))).toBe(true)
    })

    it('returns errors for missing week marker', () => {
      const input = `PROGRAM: Test
TYPE: strength

[DAY 1] Test
[STRENGTH]
A1. Exercise | 3x10`

      const result = parseProgram(input)

      expect(result.errors.some(e => e.message.includes('week'))).toBe(true)
    })
  })

  describe('getUniqueExerciseNames', () => {
    it('extracts unique exercise names', () => {
      const input = `PROGRAM: Test
TYPE: strength

[WEEK 1]

[DAY 1] Day 1
[STRENGTH]
A1. Bench Press | 3x10
A2. Squat | 3x10

[DAY 2] Day 2
[STRENGTH]
A1. Bench Press | 3x8
A2. Deadlift | 3x5`

      const result = parseProgram(input)
      const names = getUniqueExerciseNames(result)

      expect(names).toHaveLength(3)
      expect(names).toContain('Bench Press')
      expect(names).toContain('Squat')
      expect(names).toContain('Deadlift')
    })
  })
})
