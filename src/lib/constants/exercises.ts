// Exercise-related constants

// These must match the muscle_group enum in the database
export const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Chest' },
  { value: 'upper_chest', label: 'Upper Chest' },
  { value: 'back', label: 'Back' },
  { value: 'lats', label: 'Lats' },
  { value: 'rhomboids', label: 'Rhomboids' },
  { value: 'lower_traps', label: 'Lower Traps' },
  { value: 'traps', label: 'Traps' },
  { value: 'mid_back', label: 'Mid-Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'rear_delts', label: 'Rear Delts' },
  { value: 'lateral_delts', label: 'Lateral Delts' },
  { value: 'rotator_cuff', label: 'Rotator Cuff' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'glute_medius', label: 'Glute Medius' },
  { value: 'adductors', label: 'Adductors' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
  { value: 'abs', label: 'Abs' },
  { value: 'obliques', label: 'Obliques' },
  { value: 'erectors', label: 'Erectors' },
  { value: 'hip_flexors', label: 'Hip Flexors' },
  { value: 'full_body', label: 'Full Body' },
] as const

export const MOBILITY_FOCUS_AREAS = [
  { value: 'hip_flexors', label: 'Hip Flexors' },
  { value: 'hips', label: 'Hips' },
  { value: 'groin', label: 'Groin' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'quads', label: 'Quads' },
  { value: 'thoracic_spine', label: 'Thoracic Spine' },
  { value: 'lumbar_spine', label: 'Lumbar Spine' },
  { value: 'cervical_spine', label: 'Cervical Spine' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'shoulder_internal_rotation', label: 'Shoulder Internal Rotation' },
  { value: 'shoulder_external_rotation', label: 'Shoulder External Rotation' },
  { value: 'scapular', label: 'Scapular' },
  { value: 'lats', label: 'Lats' },
  { value: 'pecs', label: 'Pecs' },
  { value: 'ankles', label: 'Ankles' },
  { value: 'calves', label: 'Calves' },
  { value: 'feet', label: 'Feet' },
  { value: 'wrists', label: 'Wrists' },
  { value: 'elbows', label: 'Elbows' },
  { value: 'neck', label: 'Neck' },
] as const

export const LOGGING_TYPES = [
  { value: 'weight_reps', label: 'Weight + Reps' },
  { value: 'reps_only', label: 'Reps Only' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'weight_duration', label: 'Weight + Duration' },
] as const

export const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Kettlebell',
  'Cable Machine',
  'Smith Machine',
  'Resistance Band',
  'TRX/Suspension',
  'Pull-up Bar',
  'Bench',
  'Squat Rack',
  'Leg Press',
  'Ab Wheel',
  'Foam Roller',
  'Yoga Mat',
  'Medicine Ball',
  'Bodyweight',
  'None',
] as const

export type MuscleGroup = typeof MUSCLE_GROUPS[number]['value']
export type MobilityFocus = typeof MOBILITY_FOCUS_AREAS[number]['value']
export type LoggingType = typeof LOGGING_TYPES[number]['value']
