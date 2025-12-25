/**
 * Exercise Matcher
 * Fuzzy matching logic for mapping parsed exercise names to database exercises
 */

export interface Exercise {
  id: string
  name: string
  equipment: string | null
  muscle_groups: string[]
  type: 'strength' | 'mobility' | 'cardio'
  primary_muscle: string | null
  focus_area: string | null
}

export interface ExerciseMatch {
  parsedName: string
  status: 'matched' | 'fuzzy' | 'unmatched'
  matchedExercise?: Exercise
  suggestions?: Exercise[]
  // Resolution state (set by user)
  resolution?: 'use_match' | 'create_new' | 'pick_existing'
  selectedExerciseId?: string
  newExerciseData?: { name: string; type: 'strength' | 'mobility' | 'cardio' }
}

// Common prefixes to strip for normalized matching
const COMMON_PREFIXES = [
  'barbell',
  'dumbbell',
  'db',
  'bb',
  'cable',
  'machine',
  'seated',
  'standing',
  'lying',
  'incline',
  'decline',
  'flat',
]

// Normalize a name for comparison
function normalize(name: string): string {
  let n = name.toLowerCase().trim()

  // Remove common prefixes
  for (const prefix of COMMON_PREFIXES) {
    if (n.startsWith(prefix + ' ')) {
      n = n.slice(prefix.length + 1)
    }
  }

  // Remove extra whitespace
  n = n.replace(/\s+/g, ' ')

  return n
}

// Calculate similarity score (0-1) between two strings
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  // Exact match
  if (aLower === bLower) return 1

  // One contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    const longer = Math.max(aLower.length, bLower.length)
    const shorter = Math.min(aLower.length, bLower.length)
    return shorter / longer
  }

  // Word overlap
  const aWords = new Set(aLower.split(/\s+/))
  const bWords = new Set(bLower.split(/\s+/))
  const intersection = [...aWords].filter(w => bWords.has(w))
  const union = new Set([...aWords, ...bWords])

  return intersection.length / union.size
}

export function matchExercises(
  parsedNames: string[],
  dbExercises: Exercise[]
): ExerciseMatch[] {
  const matches: ExerciseMatch[] = []

  // Build lookup maps
  const byExactName = new Map<string, Exercise>()
  const byNormalizedName = new Map<string, Exercise>()

  for (const ex of dbExercises) {
    byExactName.set(ex.name.toLowerCase(), ex)
    byNormalizedName.set(normalize(ex.name), ex)
  }

  for (const parsedName of parsedNames) {
    const nameLower = parsedName.toLowerCase()
    const nameNormalized = normalize(parsedName)

    // Try exact match
    const exactMatch = byExactName.get(nameLower)
    if (exactMatch) {
      matches.push({
        parsedName,
        status: 'matched',
        matchedExercise: exactMatch,
        resolution: 'use_match',
        selectedExerciseId: exactMatch.id,
      })
      continue
    }

    // Try normalized match
    const normalizedMatch = byNormalizedName.get(nameNormalized)
    if (normalizedMatch) {
      matches.push({
        parsedName,
        status: 'fuzzy',
        matchedExercise: normalizedMatch,
        suggestions: [normalizedMatch],
        resolution: 'use_match',
        selectedExerciseId: normalizedMatch.id,
      })
      continue
    }

    // Find suggestions by similarity
    const scored = dbExercises
      .map(ex => ({
        exercise: ex,
        score: Math.max(
          similarity(parsedName, ex.name),
          similarity(nameNormalized, normalize(ex.name))
        ),
      }))
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (scored.length > 0 && scored[0].score > 0.6) {
      // Good fuzzy match
      matches.push({
        parsedName,
        status: 'fuzzy',
        matchedExercise: scored[0].exercise,
        suggestions: scored.map(s => s.exercise),
        resolution: 'use_match',
        selectedExerciseId: scored[0].exercise.id,
      })
    } else {
      // Unmatched
      matches.push({
        parsedName,
        status: 'unmatched',
        suggestions: scored.map(s => s.exercise),
      })
    }
  }

  return matches
}

// Check if all matches are resolved
export function allResolved(matches: ExerciseMatch[]): boolean {
  return matches.every(m =>
    m.resolution === 'use_match' ||
    m.resolution === 'pick_existing' ||
    m.resolution === 'create_new'
  )
}

// Get the final exercise ID for a match (after resolution)
export function getResolvedExerciseId(match: ExerciseMatch): string | null {
  if (match.resolution === 'use_match' || match.resolution === 'pick_existing') {
    return match.selectedExerciseId || null
  }
  return null // For create_new, the ID will be assigned after creation
}
