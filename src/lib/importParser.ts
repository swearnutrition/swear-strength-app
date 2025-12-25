/**
 * Program Import Parser
 * Parses structured text format into program data
 */

export interface ParsedProgram {
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  is_indefinite: boolean
  description: string | null
  weeks: ParsedWeek[]
  errors: ParseError[]
}

export interface ParsedWeek {
  weekNumbers: number[]
  days: ParsedDay[]
}

export interface ParsedDay {
  dayNumber: number
  name: string
  isRestDay: boolean
  restDayNotes: string | null
  exercises: ParsedExercise[]
}

export interface ParsedExercise {
  section: 'warmup' | 'strength' | 'cooldown'
  label: string | null
  name: string
  sets: string
  reps: string
  restSeconds: number | null
  rpe: number | null
  notes: string | null
  lineNumber: number
}

export interface ParseError {
  line: number
  message: string
}

// Parse duration strings like "30s", "1min", "2min", "90s" into seconds
function parseDuration(val: string): number | null {
  const v = val.toLowerCase().trim()
  if (!v) return null

  const minMatch = v.match(/^(\d+)\s*min$/)
  if (minMatch) return Number(minMatch[1]) * 60

  const secMatch = v.match(/^(\d+)\s*s$/)
  if (secMatch) return Number(secMatch[1])

  const pureNum = v.match(/^(\d+)$/)
  if (pureNum) return Number(pureNum[1])

  return null
}

// Parse sets/reps like "3x10", "3x8-10", "3x30s", "3x10 per side"
function parseSetsReps(val: string): { sets: string; reps: string } {
  const v = val.trim()
  const match = v.match(/^(\d+)x(.+)$/i)
  if (match) {
    return { sets: match[1], reps: match[2].trim() }
  }
  return { sets: '1', reps: v }
}

// Parse exercise line: "A1. Exercise Name | 3x10 | Rest: 60s | RPE: 7 | Note: text"
function parseExerciseLine(line: string, lineNumber: number, section: 'warmup' | 'strength' | 'cooldown'): ParsedExercise | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Match label (A1. or just the exercise name)
  const labelMatch = trimmed.match(/^([A-Z]\d+)\.\s*(.+)$/i)
  let label: string | null = null
  let rest: string

  if (labelMatch) {
    label = labelMatch[1].toUpperCase()
    rest = labelMatch[2]
  } else {
    rest = trimmed
  }

  // Split by pipe
  const parts = rest.split('|').map(p => p.trim())
  if (parts.length < 2) {
    // No pipe found, try to parse as just "Exercise Name | SetsxReps"
    // Or it might be a simple line like "Exercise Name"
    return null
  }

  const name = parts[0]
  const { sets, reps } = parseSetsReps(parts[1])

  let restSeconds: number | null = null
  let rpe: number | null = null
  let notes: string | null = null

  for (let i = 2; i < parts.length; i++) {
    const part = parts[i]

    const restMatch = part.match(/^Rest:\s*(.+)$/i)
    if (restMatch) {
      restSeconds = parseDuration(restMatch[1])
      continue
    }

    const rpeMatch = part.match(/^RPE:\s*(\d+)$/i)
    if (rpeMatch) {
      rpe = Number(rpeMatch[1])
      continue
    }

    const noteMatch = part.match(/^Note:\s*(.+)$/i)
    if (noteMatch) {
      notes = noteMatch[1]
      continue
    }
  }

  return {
    section,
    label,
    name,
    sets,
    reps,
    restSeconds,
    rpe,
    notes,
    lineNumber,
  }
}

export function parseProgram(text: string): ParsedProgram {
  const lines = text.split('\n')
  const errors: ParseError[] = []

  let name = ''
  let type: 'strength' | 'mobility' | 'cardio' = 'strength'
  let is_indefinite = false
  let description: string | null = null
  const weeks: ParsedWeek[] = []

  let currentWeek: ParsedWeek | null = null
  let currentDay: ParsedDay | null = null
  let currentSection: 'warmup' | 'strength' | 'cooldown' | null = null
  let inRestDay = false
  let restDayNotesLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) continue

    // Header: PROGRAM: name
    const programMatch = trimmed.match(/^PROGRAM:\s*(.+)$/i)
    if (programMatch) {
      name = programMatch[1].trim()
      continue
    }

    // Header: TYPE: strength|mobility|cardio
    const typeMatch = trimmed.match(/^TYPE:\s*(strength|mobility|cardio)$/i)
    if (typeMatch) {
      type = typeMatch[1].toLowerCase() as 'strength' | 'mobility' | 'cardio'
      continue
    }

    // Header: INDEFINITE: yes
    const indefiniteMatch = trimmed.match(/^INDEFINITE:\s*yes$/i)
    if (indefiniteMatch) {
      is_indefinite = true
      continue
    }

    // Header: DESCRIPTION: text
    const descMatch = trimmed.match(/^DESCRIPTION:\s*(.+)$/i)
    if (descMatch) {
      description = descMatch[1].trim()
      continue
    }

    // Week marker: [WEEK 1] or [WEEKS 1-3]
    const weekMatch = trimmed.match(/^\[WEEKS?\s+(\d+)(?:-(\d+))?\]$/i)
    if (weekMatch) {
      // Save previous day if exists
      if (currentDay && currentWeek) {
        if (inRestDay && restDayNotesLines.length > 0) {
          currentDay.restDayNotes = restDayNotesLines.join('\n')
        }
        currentWeek.days.push(currentDay)
      }
      currentDay = null
      currentSection = null
      inRestDay = false
      restDayNotesLines = []

      const startWeek = Number(weekMatch[1])
      const endWeek = weekMatch[2] ? Number(weekMatch[2]) : startWeek
      const weekNumbers: number[] = []
      for (let w = startWeek; w <= endWeek; w++) {
        weekNumbers.push(w)
      }

      currentWeek = { weekNumbers, days: [] }
      weeks.push(currentWeek)
      continue
    }

    // Day marker: [DAY 1] Day Name
    const dayMatch = trimmed.match(/^\[DAY\s+(\d+)\]\s*(.*)$/i)
    if (dayMatch) {
      // Save previous day if exists
      if (currentDay && currentWeek) {
        if (inRestDay && restDayNotesLines.length > 0) {
          currentDay.restDayNotes = restDayNotesLines.join('\n')
        }
        currentWeek.days.push(currentDay)
      }

      if (!currentWeek) {
        errors.push({ line: lineNumber, message: 'Day found before week marker' })
        continue
      }

      currentDay = {
        dayNumber: Number(dayMatch[1]),
        name: dayMatch[2].trim() || `Day ${dayMatch[1]}`,
        isRestDay: false,
        restDayNotes: null,
        exercises: [],
      }
      currentSection = null
      inRestDay = false
      restDayNotesLines = []
      continue
    }

    // Section markers
    if (trimmed === '[WARMUP]') {
      currentSection = 'warmup'
      inRestDay = false
      continue
    }
    if (trimmed === '[STRENGTH]') {
      currentSection = 'strength'
      inRestDay = false
      continue
    }
    if (trimmed === '[COOLDOWN]') {
      currentSection = 'cooldown'
      inRestDay = false
      continue
    }
    if (trimmed === '[REST]') {
      if (currentDay) {
        currentDay.isRestDay = true
      }
      inRestDay = true
      currentSection = null
      continue
    }

    // If in rest day, collect notes
    if (inRestDay && currentDay) {
      restDayNotesLines.push(trimmed)
      continue
    }

    // Exercise line
    if (currentSection && currentDay) {
      const exercise = parseExerciseLine(trimmed, lineNumber, currentSection)
      if (exercise) {
        currentDay.exercises.push(exercise)
      } else if (trimmed && !trimmed.startsWith('[')) {
        // Could be a malformed exercise line
        errors.push({ line: lineNumber, message: `Could not parse exercise: "${trimmed}"` })
      }
    }
  }

  // Save last day
  if (currentDay && currentWeek) {
    if (inRestDay && restDayNotesLines.length > 0) {
      currentDay.restDayNotes = restDayNotesLines.join('\n')
    }
    currentWeek.days.push(currentDay)
  }

  // Validation
  if (!name) {
    errors.push({ line: 1, message: 'Missing PROGRAM: header' })
  }
  if (weeks.length === 0) {
    errors.push({ line: 1, message: 'No weeks found. Add [WEEK 1] marker.' })
  }

  return {
    name,
    type,
    is_indefinite,
    description,
    weeks,
    errors,
  }
}

// Get all unique exercise names from parsed program
export function getUniqueExerciseNames(parsed: ParsedProgram): string[] {
  const names = new Set<string>()
  for (const week of parsed.weeks) {
    for (const day of week.days) {
      for (const exercise of day.exercises) {
        names.add(exercise.name)
      }
    }
  }
  return Array.from(names).sort()
}
