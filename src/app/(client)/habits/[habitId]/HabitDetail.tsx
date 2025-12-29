'use client'

import Link from 'next/link'

type HabitCategory = 'nutrition' | 'fitness' | 'sleep' | 'mindset' | 'lifestyle' | 'tracking'

interface HabitTemplate {
  name: string
  description: string | null
  target_value: number | null
  target_unit: string | null
  category: HabitCategory | null
  frequency: string
}

interface Habit {
  id: string
  start_date: string
  custom_target_value: number | null
  custom_target_unit: string | null
  habit_templates: HabitTemplate | HabitTemplate[] | null
}

interface Stats {
  currentStreak: number
  longestStreak: number
  totalCount: number
  completionRate: number
}

interface YearDay {
  date: string
  completed: boolean
}

interface Month {
  label: string
  week: number
}

interface HabitDetailProps {
  habit: Habit
  stats: Stats
  yearData: YearDay[]
  months: Month[]
}

// Colors matching the dark dashboard
const colors = {
  bg: '#0f0f1a',
  card: '#1a1a2e',
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  green: '#10b981',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#2a2a40',
}

// Brand color palette (purple + blue gradient)
const brandPalette = {
  empty: '#1a1a2e',
  light: '#2d2b55',
  medium: '#5b4cad',
  full: '#8b5cf6',
}

const categoryLabels: Record<HabitCategory, string> = {
  nutrition: 'Nutrition',
  fitness: 'Fitness',
  sleep: 'Sleep',
  mindset: 'Mindset',
  lifestyle: 'Lifestyle',
  tracking: 'Tracking',
}

// Helper to safely get template from habit
function getHabitTemplate(habit: Habit): HabitTemplate {
  const defaultTemplate: HabitTemplate = {
    name: 'Habit',
    description: null,
    target_value: null,
    target_unit: null,
    category: 'tracking',
    frequency: 'daily',
  }
  if (!habit.habit_templates) return defaultTemplate
  if (Array.isArray(habit.habit_templates)) return habit.habit_templates[0] || defaultTemplate
  return habit.habit_templates
}

export function HabitDetail({ habit, stats, yearData, months }: HabitDetailProps) {
  const template = getHabitTemplate(habit)
  const category = template.category || 'tracking'

  const targetValue = habit.custom_target_value || template.target_value
  const targetUnit = habit.custom_target_unit || template.target_unit

  // Organize year data into weeks (7 days per week, ~53 weeks)
  const weeks: YearDay[][] = []
  for (let i = 0; i < yearData.length; i += 7) {
    weeks.push(yearData.slice(i, i + 7))
  }

  return (
    <div style={{
      background: colors.bg,
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      paddingBottom: '40px',
    }}>
      {/* Status Bar Spacer */}
      <div style={{ height: '50px' }} />

      {/* Header */}
      <div style={{
        padding: '0 20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Link href="/dashboard" style={{ color: colors.textMuted, marginTop: '4px' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: colors.textPrimary,
              marginBottom: '8px',
            }}>
              {template.name}
            </h1>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              background: `${brandPalette.full}20`,
              color: brandPalette.full,
            }}>
              {categoryLabels[category]}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}>
          {[
            { value: stats.currentStreak, label: 'CURRENT', sublabel: 'STREAK' },
            { value: stats.longestStreak, label: 'LONGEST', sublabel: 'STREAK' },
            { value: stats.totalCount, label: 'TOTAL', sublabel: 'COUNT' },
            { value: `${stats.completionRate}%`, label: 'COMPLETION', sublabel: 'RATE', highlight: true },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                background: colors.card,
                borderRadius: '14px',
                padding: '14px 8px',
                textAlign: 'center',
                border: `1px solid ${colors.border}`,
              }}
            >
              <p style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: stat.highlight ? brandPalette.full : colors.textPrimary,
                marginBottom: '4px',
              }}>
                {stat.value}
              </p>
              <p style={{
                margin: 0,
                fontSize: '9px',
                fontWeight: 600,
                color: colors.textMuted,
                letterSpacing: '0.5px',
                lineHeight: 1.3,
              }}>
                {stat.label}<br/>{stat.sublabel}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Contribution Graph */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div style={{
          background: colors.card,
          borderRadius: '20px',
          padding: '20px',
          border: `1px solid ${colors.border}`,
          overflowX: 'auto',
        }}>
          {/* Graph Container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: 'fit-content',
          }}>
            {/* Day Labels (left side) */}
            <div style={{ display: 'flex', gap: '2px' }}>
              {/* Empty space for day labels column */}
              <div style={{ width: '20px', flexShrink: 0 }} />

              {/* Weeks */}
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {week.map((day, dayIndex) => {
                    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
                    const isToday = day.date === today
                    const isFuture = day.date > today

                    return (
                      <div
                        key={dayIndex}
                        title={`${day.date}${day.completed ? ' - Completed' : ''}`}
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '2px',
                          background: isFuture
                            ? colors.bg
                            : day.completed
                              ? brandPalette.full
                              : brandPalette.empty,
                          border: isToday ? `1px solid ${brandPalette.full}` : 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Month Labels */}
            <div style={{
              display: 'flex',
              marginTop: '8px',
              marginLeft: '20px',
            }}>
              {months.map((month, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: `${((months[i + 1]?.week || 53) - month.week) * 12}px`,
                  }}
                >
                  <span style={{
                    fontSize: '10px',
                    color: colors.textMuted,
                    fontWeight: 500,
                  }}>
                    {month.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '6px',
            marginTop: '16px',
          }}>
            <span style={{ fontSize: '10px', color: colors.textMuted }}>Less</span>
            {[brandPalette.empty, brandPalette.light, brandPalette.medium, brandPalette.full].map((color, i) => (
              <div
                key={i}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: color,
                }}
              />
            ))}
            <span style={{ fontSize: '10px', color: colors.textMuted }}>More</span>
          </div>
        </div>
      </div>

      {/* Habit Details */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: colors.card,
          borderRadius: '20px',
          padding: '20px',
          border: `1px solid ${colors.border}`,
        }}>
          <h3 style={{
            margin: '0 0 16px',
            fontSize: '14px',
            fontWeight: 600,
            color: colors.textPrimary,
          }}>
            Details
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {targetValue && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: colors.textMuted }}>Target</span>
                <span style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 500 }}>
                  {targetValue} {targetUnit || ''}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: colors.textMuted }}>Frequency</span>
              <span style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 500, textTransform: 'capitalize' }}>
                {template.frequency.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: colors.textMuted }}>Started</span>
              <span style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 500 }}>
                {new Date(habit.start_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            {template.description && (
              <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: `1px solid ${colors.border}` }}>
                <span style={{ fontSize: '13px', color: colors.textMuted }}>Description</span>
                <p style={{
                  margin: '8px 0 0',
                  fontSize: '13px',
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                }}>
                  {template.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
