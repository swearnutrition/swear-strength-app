'use client'

import { useRef, useState } from 'react'
import type { Program } from '../types'
import { formatRestTime } from '../utils/parseRest'

interface ProgramPDFExportProps {
  program: Program
  onClose: () => void
}

export function ProgramPDFExport({ program, onClose }: ProgramPDFExportProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!contentRef.current) return
    setExporting(true)

    try {
      const html2pdf = (await import('html2pdf.js')).default

      const opt = {
        margin: 0,
        filename: `${program.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: 'css', before: '.page-break' },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await html2pdf().set(opt as any).from(contentRef.current).save()
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  // Calculate stats
  const totalWeeks = program.program_weeks.length
  const totalWorkouts = program.program_weeks.reduce((acc, w) => acc + w.workout_days.filter(d => !d.is_rest_day).length, 0)
  const sessionsPerWeek = totalWeeks > 0 ? Math.round(totalWorkouts / totalWeeks) : 0

  // Get all workouts organized by week (not deduplicated - shows week-specific variations)
  const allWorkoutsByWeek = program.program_weeks.map(week => ({
    weekNumber: week.week_number,
    weekName: week.name,
    workouts: week.workout_days.filter(d => !d.is_rest_day)
  }))

  // Get unique strength exercises for progress tracking
  const strengthExercises = new Set<string>()
  program.program_weeks.forEach(w => {
    w.workout_days.forEach(day => {
      day.workout_exercises
        .filter(e => e.section === 'strength')
        .forEach(e => {
          if (e.exercise?.name) strengthExercises.add(e.exercise.name)
        })
    })
  })

  // Calculate muscle volume for PDF summary
  const muscleVolume = (() => {
    const normalizeMuscle = (muscle: string): string => {
      const m = muscle.toLowerCase().trim()
      const mappings: Record<string, string> = {
        'pectorals': 'Chest', 'pecs': 'Chest', 'chest': 'Chest',
        'deltoids': 'Shoulders', 'delts': 'Shoulders', 'shoulders': 'Shoulders', 'front delts': 'Shoulders', 'side delts': 'Shoulders',
        'rear delts': 'Rear Delts', 'posterior deltoids': 'Rear Delts',
        'lats': 'Lats', 'latissimus': 'Lats',
        'back': 'Back', 'upper back': 'Back', 'rhomboids': 'Back',
        'traps': 'Traps', 'trapezius': 'Traps',
        'quads': 'Quads', 'quadriceps': 'Quads',
        'hamstrings': 'Hamstrings', 'hams': 'Hamstrings',
        'glutes': 'Glutes', 'gluteus': 'Glutes',
        'calves': 'Calves', 'gastrocnemius': 'Calves',
        'abs': 'Abs', 'abdominals': 'Abs', 'core': 'Abs',
        'obliques': 'Obliques',
        'lower back': 'Lower Back', 'erectors': 'Lower Back', 'spinal erectors': 'Lower Back',
        'biceps': 'Biceps', 'triceps': 'Triceps', 'forearms': 'Forearms', 'grip': 'Forearms',
      }
      return mappings[m] || m.charAt(0).toUpperCase() + m.slice(1)
    }

    const parseSets = (setsStr: string | null): number => {
      if (!setsStr) return 0
      const cleaned = setsStr.trim()
      if (cleaned.includes('-')) {
        const [min, max] = cleaned.split('-').map(s => parseInt(s.trim()))
        return (min + max) / 2
      }
      return parseInt(cleaned) || 0
    }

    const muscleMap = new Map<string, { primary: number; secondary: number }>()

    for (const week of program.program_weeks) {
      for (const day of week.workout_days) {
        if (day.is_rest_day) continue
        for (const we of day.workout_exercises) {
          if (we.section !== 'strength') continue
          const exercise = we.exercise
          if (!exercise) continue
          const sets = parseSets(we.sets)
          if (sets === 0) continue

          if (exercise.primary_muscle) {
            const normalized = normalizeMuscle(exercise.primary_muscle)
            const current = muscleMap.get(normalized) || { primary: 0, secondary: 0 }
            muscleMap.set(normalized, { primary: current.primary + sets, secondary: current.secondary })
          }

          if (exercise.muscle_groups) {
            for (const muscle of exercise.muscle_groups) {
              if (exercise.primary_muscle && normalizeMuscle(muscle) === normalizeMuscle(exercise.primary_muscle)) continue
              const normalized = normalizeMuscle(muscle)
              const current = muscleMap.get(normalized) || { primary: 0, secondary: 0 }
              muscleMap.set(normalized, { primary: current.primary, secondary: current.secondary + sets })
            }
          }
        }
      }
    }

    return Array.from(muscleMap.entries())
      .map(([muscle, data]) => ({
        muscle,
        sets: data.primary + (data.secondary * 0.5),
        primary: data.primary,
        secondary: data.secondary,
      }))
      .filter(v => v.sets > 0)
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 12) // Top 12 muscles
  })()

  // Colors - muted palette
  const colors = {
    darkBg: '#1e1b4b',
    darkBgLight: '#312e81',
    purple: '#7c3aed',
    purpleLight: '#a78bfa',
    amber: '#f59e0b',
    white: '#ffffff',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray800: '#1f2937',
  }

  // Page styles
  const pageStyle = {
    width: '210mm',
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: colors.white,
  }

  const fullPageStyle = {
    width: '210mm',
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: colors.white,
  }

  const darkPageStyle = {
    width: '210mm',
    height: '297mm',
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: colors.darkBg,
    color: colors.white,
    position: 'relative' as const,
    overflow: 'hidden',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold">Export Program to PDF</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {exporting ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-slate-200">
          <div ref={contentRef} style={{ margin: '0 auto' }}>

            {/* PAGE 1: Cover */}
            <div style={darkPageStyle}>
              {/* Decorative circles */}
              <div style={{
                position: 'absolute',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                backgroundColor: colors.darkBgLight,
                opacity: 0.5,
                top: '-100px',
                right: '-100px',
              }} />
              <div style={{
                position: 'absolute',
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                backgroundColor: colors.darkBgLight,
                opacity: 0.3,
                bottom: '-50px',
                left: '-50px',
              }} />

              {/* Logo */}
              <div style={{ padding: '40px', position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '1px' }}>SWEAR STRENGTH</div>
                <div style={{ width: '40px', height: '3px', backgroundColor: colors.purple, marginTop: '8px' }} />
              </div>

              {/* Title */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                zIndex: 1,
                width: '80%'
              }}>
                <h1 style={{ fontSize: '48px', fontWeight: '800', margin: 0, lineHeight: 1.1 }}>
                  {program.name}
                </h1>
                <div style={{
                  marginTop: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: colors.gray400,
                  fontSize: '14px'
                }}>
                  <span>{totalWeeks}-Week Program</span>
                  <span style={{ color: colors.purple }}>•</span>
                  <span>{sessionsPerWeek} Sessions Per Week</span>
                </div>
                <div style={{ width: '60px', height: '4px', backgroundColor: colors.purple, margin: '24px auto 0', borderRadius: '2px' }} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '40px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700' }}>{totalWeeks}</div>
                    <div style={{ fontSize: '12px', color: colors.gray400, marginTop: '4px' }}>Weeks</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700' }}>{totalWorkouts}</div>
                    <div style={{ fontSize: '12px', color: colors.gray400, marginTop: '4px' }}>Sessions</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700' }}>40-45</div>
                    <div style={{ fontSize: '12px', color: colors.gray400, marginTop: '4px' }}>Minutes</div>
                  </div>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center', color: colors.gray400, fontSize: '12px' }}>
                swearnutrition.com
              </div>
            </div>

            {/* PAGE 2: Program Overview */}
            <div className="page-break" style={fullPageStyle}>
              {/* Header bar */}
              <div style={{ backgroundColor: colors.darkBg, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: colors.white, letterSpacing: '1px' }}>SWEAR STRENGTH</div>
                <div style={{ fontSize: '10px', color: colors.gray400 }}>{program.name}</div>
              </div>

              <div style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: colors.gray800, margin: '0 0 16px 0' }}>Program Overview</h2>

                {program.description && (
                  <div style={{ backgroundColor: colors.gray50, padding: '12px 14px', borderRadius: '6px', marginBottom: '20px', borderLeft: `3px solid ${colors.purple}` }}>
                    <p style={{ margin: 0, color: colors.gray600, fontSize: '12px', lineHeight: 1.5 }}>{program.description}</p>
                  </div>
                )}

                {/* Weekly Schedule - Only show if configured */}
                {program.pdf_schedule && program.pdf_schedule.some(s => s) && (
                  <>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.gray800, margin: '16px 0 8px 0' }}>Recommended Schedule</h3>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', marginBottom: '16px' }}>
                      <tbody>
                        <tr>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                            const workoutName = program.pdf_schedule?.[idx] || ''
                            const isWorkoutDay = !!workoutName
                            return (
                              <td key={day} style={{
                                width: '14.28%',
                                textAlign: 'center',
                                padding: '6px 2px',
                                borderRadius: '4px',
                                backgroundColor: isWorkoutDay ? colors.darkBg : colors.gray100,
                                color: isWorkoutDay ? colors.white : colors.gray400
                              }}>
                                <div style={{ fontSize: '8px', fontWeight: '600', marginBottom: '1px' }}>{day}</div>
                                <div style={{ fontSize: '9px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {workoutName || 'Rest'}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {/* Quick Tips - Only show if configured */}
                {program.pdf_tips && program.pdf_tips.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.gray800, margin: '0 0 8px 0' }}>Quick Tips</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {program.pdf_tips.map((tip, idx) => (
                          <tr key={idx}>
                            <td style={{ width: '12px', verticalAlign: 'top', paddingTop: '4px', paddingBottom: '3px' }}>
                              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: colors.purple }} />
                            </td>
                            <td style={{ color: colors.gray600, fontSize: '10px', lineHeight: 1.4, paddingBottom: '4px' }}>{tip}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Muscle Volume Summary */}
                {muscleVolume.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.gray800, margin: '16px 0 8px 0' }}>Volume Distribution</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {muscleVolume.map((vol, idx) => {
                        const maxSets = muscleVolume[0]?.sets || 1
                        const barWidth = Math.max(20, (vol.sets / maxSets) * 100)
                        return (
                          <div key={idx} style={{
                            flex: '0 0 calc(50% - 4px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '9px',
                          }}>
                            <div style={{ width: '60px', color: colors.gray600, fontWeight: '500' }}>{vol.muscle}</div>
                            <div style={{ flex: 1, height: '8px', backgroundColor: colors.gray100, borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${barWidth}%`,
                                height: '100%',
                                backgroundColor: colors.purple,
                                borderRadius: '4px',
                              }} />
                            </div>
                            <div style={{ width: '28px', textAlign: 'right', color: colors.gray500, fontSize: '8px' }}>
                              {vol.sets.toFixed(0)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '8px', color: colors.gray400 }}>
                      Total sets per muscle group across all {totalWeeks} week{totalWeeks !== 1 ? 's' : ''} (weighted: primary = 1, secondary = 0.5)
                    </div>
                  </>
                )}

              </div>
              <div style={{ textAlign: 'center', padding: '12px', color: colors.gray400, fontSize: '10px' }}>2</div>
            </div>

            {/* WORKOUT PAGES - Traditional tracking table layout */}
            <div className="page-break" style={pageStyle}>
              <div style={{ backgroundColor: colors.darkBg, padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: colors.white, letterSpacing: '1px' }}>SWEAR STRENGTH</div>
                <div style={{ fontSize: '10px', color: colors.gray400 }}>{program.name}</div>
              </div>

              <div style={{ padding: '16px 24px' }}>
                {allWorkoutsByWeek.map((weekData, weekIndex) => (
                  <div key={weekIndex} style={{ marginBottom: '24px' }}>
                    {/* Week Header - Simple text */}
                    <div style={{ fontSize: '14px', fontWeight: '700', color: colors.gray800, marginBottom: '12px', borderBottom: `2px solid ${colors.darkBg}`, paddingBottom: '4px' }}>
                      Week {weekData.weekNumber}
                    </div>

                    {weekData.workouts.map((day, dayIndex) => (
                      <div key={day.id} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
                        {/* Workout Header - Bigger, cleaner */}
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: colors.darkBg }}>{day.name}</span>
                          {day.subtitle && <span style={{ color: colors.gray500, marginLeft: '8px', fontSize: '11px' }}>{day.subtitle}</span>}
                          <span style={{ color: colors.gray400, marginLeft: '12px', fontSize: '11px' }}>~40-45 min</span>
                        </div>

                        {/* Sections with tracking boxes */}
                        {(['warmup', 'strength', 'cooldown'] as const).map((section) => {
                          const sectionExercises = day.workout_exercises.filter(e => e.section === section)
                          if (sectionExercises.length === 0) return null

                          // Helper to format reps
                          const formatReps = (reps: string | null) => {
                            if (!reps) return '-'
                            return reps.replace(/\s*per\s*side/gi, '/side').replace(/\s*each\s*side/gi, '/side')
                          }

                          // Get number of sets for tracking boxes
                          const getSetCount = (sets: string | null) => {
                            if (!sets) return 3
                            const num = parseInt(sets)
                            return isNaN(num) ? 3 : Math.min(num, 5)
                          }

                          return (
                            <div key={section} style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '8px', fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', borderBottom: `1px solid ${colors.gray200}`, paddingBottom: '2px' }}>
                                {section}
                              </div>

                              {/* Table header */}
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '30%' }}>EXERCISE</th>
                                    <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '6%' }}>DEMO</th>
                                    <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '8%' }}>TARGET</th>
                                    <th style={{ textAlign: 'center', padding: '4px 2px', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '10%' }}>SET 1</th>
                                    <th style={{ textAlign: 'center', padding: '4px 2px', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '10%' }}>SET 2</th>
                                    <th style={{ textAlign: 'center', padding: '4px 2px', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '10%' }}>SET 3</th>
                                    <th style={{ textAlign: 'center', padding: '4px 2px', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '10%' }}>SET 4</th>
                                    <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: '600', color: colors.gray500, fontSize: '7px', width: '6%' }}>VOL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sectionExercises.map((exercise, idx) => {
                                    const setCount = getSetCount(exercise.sets)
                                    return (
                                      <tr key={exercise.id} style={{ borderBottom: `1px solid ${colors.gray100}` }}>
                                        <td style={{ padding: '6px 4px 6px 0', verticalAlign: 'middle' }}>
                                          {exercise.label && (
                                            <span style={{ color: colors.gray400, fontWeight: '600', marginRight: '4px', fontSize: '8px' }}>{exercise.label}</span>
                                          )}
                                          <span style={{ fontWeight: '500', color: colors.gray800, fontSize: '9px' }}>{exercise.exercise?.name || 'Unknown'}</span>
                                        </td>
                                        <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                          {exercise.exercise?.video_url ? (
                                            <a href={exercise.exercise.video_url} style={{ color: colors.gray400, fontSize: '7px', textDecoration: 'none' }}>▶ Demo</a>
                                          ) : (
                                            <span style={{ color: colors.gray200 }}>-</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                          <span style={{ fontSize: '8px', color: colors.gray600 }}>{exercise.sets || '-'}×{formatReps(exercise.reps)}</span>
                                          {exercise.rpe && <span style={{ fontSize: '7px', color: colors.gray400, display: 'block' }}>@{exercise.rpe}</span>}
                                        </td>
                                        {[1, 2, 3, 4].map((setNum) => (
                                          <td key={setNum} style={{ padding: '4px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {setNum <= setCount ? (
                                              <div style={{ border: `1px solid ${colors.gray300}`, borderRadius: '3px', minHeight: '20px', backgroundColor: colors.white }}></div>
                                            ) : (
                                              <span style={{ color: colors.gray200 }}>-</span>
                                            )}
                                          </td>
                                        ))}
                                        <td style={{ padding: '4px 0', textAlign: 'center', verticalAlign: 'middle' }}>
                                          <div style={{ border: `1px solid ${colors.gray200}`, borderRadius: '3px', minHeight: '20px', backgroundColor: colors.gray50 }}></div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}

                        {/* Cardio Notes */}
                        {day.cardio_notes && (
                          <div style={{ marginTop: '8px', padding: '8px 10px', backgroundColor: '#FFF7ED', borderRadius: '4px', borderLeft: `3px solid #F97316` }}>
                            <div style={{ fontSize: '8px', fontWeight: '700', color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                              Cardio
                            </div>
                            <div style={{ fontSize: '9px', color: colors.gray600, whiteSpace: 'pre-wrap' }}>
                              {day.cardio_notes}
                            </div>
                          </div>
                        )}

                        {/* Divider between workouts */}
                        {dayIndex < weekData.workouts.length - 1 && (
                          <div style={{ borderBottom: `1px dashed ${colors.gray300}`, marginTop: '12px' }} />
                        )}
                      </div>
                    ))}

                    {/* Divider between weeks */}
                    {weekIndex < allWorkoutsByWeek.length - 1 && (
                      <div style={{ borderBottom: `2px solid ${colors.darkBg}`, marginTop: '20px', marginBottom: '20px' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* BACK COVER */}
            <div className="page-break" style={darkPageStyle}>
              <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', backgroundColor: colors.darkBgLight, opacity: 0.3, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', backgroundColor: colors.darkBgLight, opacity: 0.5, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '2px', marginBottom: '16px' }}>SWEAR STRENGTH</div>
                <div style={{ color: colors.gray400, fontSize: '14px', letterSpacing: '2px' }}>Strength • Consistency • Results</div>
                <div style={{ marginTop: '48px', color: colors.gray400, fontSize: '13px' }}>
                  <div>swearnutrition.com</div>
                  <div style={{ marginTop: '8px' }}>@swearstrength</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
