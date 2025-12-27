'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useColors } from '@/hooks/useColors'
import { useTheme } from '@/lib/theme'

type HabitCategory = 'nutrition' | 'fitness' | 'sleep' | 'mindset' | 'lifestyle' | 'tracking'

interface HabitTemplate {
  name: string
  description: string | null
  category: HabitCategory | null
}

interface ClientHabit {
  id: string
  start_date: string
  habit_templates: HabitTemplate | HabitTemplate[] | null
}

interface Completion {
  id: string
  client_habit_id: string
  completed_date: string
  value: number | null
}

interface HabitsHistoryProps {
  habits: ClientHabit[]
  completions: Completion[]
  initials: string
}

// Category colors
const categoryColors: Record<HabitCategory, string> = {
  nutrition: '#10b981',
  fitness: '#8b5cf6',
  sleep: '#6366f1',
  mindset: '#f59e0b',
  lifestyle: '#ec4899',
  tracking: '#64748b',
}

// Helper to safely get template from habit
function getHabitTemplate(habit: ClientHabit): HabitTemplate {
  const defaultTemplate: HabitTemplate = {
    name: 'Habit',
    description: null,
    category: 'tracking'
  }
  if (!habit.habit_templates) return defaultTemplate
  if (Array.isArray(habit.habit_templates)) return habit.habit_templates[0] || defaultTemplate
  return habit.habit_templates
}

type ViewMode = '7D' | '30D' | '90D'

export function HabitsHistory({ habits, completions, initials }: HabitsHistoryProps) {
  const colors = useColors()
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const [viewMode, setViewMode] = useState<ViewMode>('30D')
  const [isDesktop, setIsDesktop] = useState(false)

  // Missed dot color - needs good contrast in both themes
  const missedDotColor = isLight ? '#cbd5e1' : colors.cardLight

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  // Build completion set for quick lookups
  const completionSet = useMemo(() => {
    const set = new Map<string, Set<string>>()
    completions.forEach(c => {
      if (!set.has(c.client_habit_id)) {
        set.set(c.client_habit_id, new Set())
      }
      set.get(c.client_habit_id)!.add(c.completed_date)
    })
    return set
  }, [completions])

  // Get date range based on view mode
  const dateRange = useMemo(() => {
    const today = new Date()
    const todayStr = today.toLocaleDateString('en-CA')
    const days = viewMode === '7D' ? 7 : viewMode === '30D' ? 30 : 90

    const dates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toLocaleDateString('en-CA'))
    }

    return { dates, todayStr }
  }, [viewMode])

  // Calculate stats for each habit
  const habitStats = useMemo(() => {
    return habits.map(habit => {
      const habitCompletions = completionSet.get(habit.id) || new Set()
      const template = getHabitTemplate(habit)

      // Calculate streak
      let currentStreak = 0
      const today = new Date()
      const checkDate = new Date(today)

      for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toLocaleDateString('en-CA')
        if (habitCompletions.has(dateStr)) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else if (i === 0) {
          // Today not done yet, check from yesterday
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }

      // Calculate longest streak
      const sortedDates = Array.from(habitCompletions).sort()
      let longestStreak = 0
      let tempStreak = 0

      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
          tempStreak = 1
        } else {
          const prevDate = new Date(sortedDates[i - 1])
          const currDate = new Date(sortedDates[i])
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

          if (diffDays === 1) {
            tempStreak++
          } else {
            tempStreak = 1
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak)
      }

      // Total completed
      const totalCompleted = habitCompletions.size

      // Grid data for view mode
      const gridData = dateRange.dates.map(date => ({
        date,
        completed: habitCompletions.has(date),
        isToday: date === dateRange.todayStr,
      }))

      return {
        habit,
        template,
        currentStreak,
        longestStreak,
        totalCompleted,
        gridData,
        category: template.category || 'tracking',
      }
    })
  }, [habits, completionSet, dateRange])

  // Overall stats
  const overallStats = useMemo(() => {
    const totalPossible = habits.length * dateRange.dates.length
    let totalCompleted = 0

    dateRange.dates.forEach(date => {
      habits.forEach(habit => {
        if (completionSet.get(habit.id)?.has(date)) {
          totalCompleted++
        }
      })
    })

    return {
      completionRate: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0,
      totalCompleted,
      totalPossible,
    }
  }, [habits, dateRange, completionSet])

  // Grid columns based on view mode
  const gridCols = viewMode === '7D' ? 7 : viewMode === '30D' ? 10 : 15

  return (
    <div style={{
      background: colors.bg,
      minHeight: '100vh',
      maxWidth: isDesktop ? '900px' : '430px',
      margin: '0 auto',
      padding: isDesktop ? '32px' : '0 0 100px',
    }}>
      {!isDesktop && <div style={{ height: '50px' }} />}

      {/* Header */}
      <div style={{
        padding: isDesktop ? '0 0 24px' : '0 20px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard" style={{ color: colors.textMuted }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 style={{
            margin: 0,
            fontSize: isDesktop ? '24px' : '20px',
            fontWeight: 700,
            color: colors.textPrimary,
          }}>
            Habit Stats
          </h1>
        </div>

        {/* View Mode Toggle */}
        <div style={{
          display: 'flex',
          background: colors.card,
          borderRadius: '10px',
          padding: '4px',
          border: `1px solid ${colors.border}`,
        }}>
          {(['7D', '30D', '90D'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === mode ? colors.purple : 'transparent',
                color: viewMode === mode ? 'white' : colors.textMuted,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Stats */}
      <div style={{ padding: isDesktop ? '0' : '0 20px' }}>
        <div style={{
          background: colors.card,
          borderRadius: '20px',
          padding: '20px',
          border: `1px solid ${colors.border}`,
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: colors.purple }}>
                {overallStats.completionRate}%
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textMuted }}>
                Completion Rate
              </p>
            </div>
            <div style={{ width: '1px', background: colors.border }} />
            <div>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: colors.green }}>
                {overallStats.totalCompleted}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textMuted }}>
                Completed
              </p>
            </div>
            <div style={{ width: '1px', background: colors.border }} />
            <div>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: colors.textPrimary }}>
                {habits.length}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textMuted }}>
                Active Habits
              </p>
            </div>
          </div>
        </div>

        {/* Habits with Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {habitStats.map(({ habit, template, currentStreak, longestStreak, totalCompleted, gridData, category }) => {
            const color = categoryColors[category]

            return (
              <div
                key={habit.id}
                style={{
                  background: colors.card,
                  borderRadius: '20px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                {/* Habit Header */}
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: 700,
                    color: colors.textPrimary,
                  }}>
                    {template.name}
                  </h3>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: colors.textMuted,
                  }}>
                    <span>Streak: <strong style={{ color: colors.amber }}>{currentStreak}</strong></span>
                    <span>Longest: <strong style={{ color: colors.textSecondary }}>{longestStreak}</strong></span>
                    <span>Completed: <strong style={{ color: colors.green }}>{totalCompleted}</strong></span>
                  </div>
                </div>

                {/* Dot Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                  gap: '4px',
                }}>
                  {gridData.map((day, i) => (
                    <div
                      key={i}
                      title={`${day.date}${day.completed ? ' - Completed' : ''}`}
                      style={{
                        aspectRatio: '1',
                        borderRadius: '50%',
                        background: day.completed ? color : missedDotColor,
                        border: day.isToday ? `2px solid ${colors.purple}` : 'none',
                        opacity: day.completed ? 1 : (isLight ? 0.6 : 0.4),
                        transition: 'all 0.15s ease',
                        maxWidth: '16px',
                        maxHeight: '16px',
                      }}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: `1px solid ${colors.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: '11px', color: colors.textMuted }}>Completed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: missedDotColor, opacity: isLight ? 0.6 : 0.4 }} />
                    <span style={{ fontSize: '11px', color: colors.textMuted }}>Missed</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {habits.length === 0 && (
          <div style={{
            background: colors.card,
            borderRadius: '20px',
            padding: '60px 20px',
            border: `1px solid ${colors.border}`,
            textAlign: 'center',
          }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={1.5} style={{ margin: '0 auto 16px', display: 'block' }}>
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <p style={{ color: colors.textMuted, fontSize: '15px', margin: 0 }}>
              No habits to track yet
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation (mobile) */}
      {!isDesktop && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          padding: '12px 24px 28px',
          background: `linear-gradient(180deg, transparent 0%, ${colors.bg} 20%)`,
        }}>
          <div style={{
            background: colors.card,
            borderRadius: '20px',
            padding: '8px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            border: `1px solid ${colors.border}`,
          }}>
            {[
              { id: 'home', label: 'Home', href: '/dashboard' },
              { id: 'stats', label: 'Stats', href: '/habits/history', active: true },
              { id: 'profile', label: 'Profile', href: '/settings' },
            ].map(tab => (
              <Link
                key={tab.id}
                href={tab.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 24px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                }}
              >
                {tab.id === 'home' && (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                )}
                {tab.id === 'stats' && (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.purple} strokeWidth={2}>
                    <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                  </svg>
                )}
                {tab.id === 'profile' && (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
                <span style={{ fontSize: '11px', fontWeight: 600, color: tab.id === 'stats' ? colors.purple : colors.textMuted }}>
                  {tab.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
