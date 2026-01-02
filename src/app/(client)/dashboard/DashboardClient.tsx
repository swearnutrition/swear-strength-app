'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/NotificationBell'
import { WorkoutScheduleModal } from '@/components/WorkoutScheduleModal'
import { useColors } from '@/hooks/useColors'
import { useTheme } from '@/lib/theme'

type HabitCategory = 'nutrition' | 'fitness' | 'sleep' | 'mindset' | 'lifestyle' | 'tracking'

interface HabitTemplate {
  name: string
  description: string | null
  target_value: number | null
  target_unit: string | null
  category: HabitCategory | null
}

interface ClientHabit {
  id: string
  custom_target_value: number | null
  custom_target_unit: string | null
  habit_templates: HabitTemplate | HabitTemplate[] | null
}

interface HabitCompletion {
  id: string
  client_habit_id: string
  value: number | null
}

interface WeekHabitCompletion {
  id: string
  client_habit_id: string
  completed_date: string
  value: number | null
}

interface HabitWeekDay {
  dayName: string
  dateStr: string
  isToday: boolean
  isPast: boolean
  isFuture: boolean
}

interface TodayWorkout {
  id: string
  name: string
  subtitle: string | null
  exerciseCount: number
  estimatedDuration: number
  week: number
  dayNumber: number
}

interface WeekWorkoutInfo {
  id: string
  name: string
  subtitle: string | null
  exerciseCount: number
  estimatedDuration: number
  week: number
  dayNumber: number
  completed: boolean
}

interface WeekDay {
  dayName: string
  dayNum: number
  isToday: boolean
  isPast: boolean
  completed: boolean
  hasWorkout: boolean
}

interface Rivalry {
  id: string
  habit_name: string
  opponent_name: string
  my_score: number
  opponent_score: number
  days_left: number
  user_initial: string
  opponent_initial: string
  user_avatar_url: string | null
  opponent_avatar_url: string | null
}

interface ScheduleInfo {
  assignmentId: string
  programName: string
  workoutDaysPerWeek: number
  cardioDaysPerWeek: number
  scheduledDays: number[] | null
  scheduledCardioDays: number[] | null
  needsSchedule: boolean
  isFlexibleMode?: boolean
}

// All workout days from the current week's program (to reuse for other weeks)
interface ProgramWorkoutDay {
  id: string
  name: string
  subtitle: string | null
  exerciseCount: number
  estimatedDuration: number
  week: number
  dayNumber: number
}

interface DashboardClientProps {
  userName: string
  initials: string
  userId: string
  greeting: string
  todayWorkout: TodayWorkout | null
  weekDays: WeekDay[]
  weekWorkouts: Record<number, WeekWorkoutInfo>
  workoutsThisWeek: number
  totalWorkoutsInWeek: number
  habits: ClientHabit[]
  todayCompletions: HabitCompletion[]
  weekHabitCompletions: WeekHabitCompletion[]
  habitWeekDays: HabitWeekDay[]
  overallStreak: number
  rivalry?: Rivalry | null
  scheduleInfo?: ScheduleInfo | null
  programWorkoutDays?: ProgramWorkoutDay[] // All workout days from current week to reuse
}

// Helper to handle Supabase returning array or single object or null
function getHabitTemplate(habit: ClientHabit): HabitTemplate {
  const defaultTemplate: HabitTemplate = { name: 'Habit', description: null, target_value: null, target_unit: null, category: null }
  if (!habit.habit_templates) return defaultTemplate
  if (Array.isArray(habit.habit_templates)) return habit.habit_templates[0] || defaultTemplate
  return habit.habit_templates
}

// Habit icons by category
const habitIcons: Record<HabitCategory, string> = {
  nutrition: '🍎',
  fitness: '🏃',
  sleep: '😴',
  mindset: '🧘',
  lifestyle: '💊',
  tracking: '📊',
}

// Icons component
const Icons = {
  home: ({ size = 24, color = 'currentColor', filled = false }: { size?: number; color?: string; filled?: boolean }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  calendar: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  dumbbell: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M3 10v4M21 10v4M5 8v8M19 8v8M7 6v12M17 6v12"/>
    </svg>
  ),
  user: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  chat: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  check: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  plus: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  chevronRight: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  chevronLeft: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  swords: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <line x1="16" y1="16" x2="20" y2="20"/>
      <line x1="19" y1="21" x2="21" y2="19"/>
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
      <line x1="5" y1="14" x2="9" y2="18"/>
      <line x1="7" y1="17" x2="4" y2="20"/>
      <line x1="3" y1="19" x2="5" y2="21"/>
    </svg>
  ),
}

export function DashboardClient({
  userName,
  initials,
  userId,
  greeting,
  todayWorkout,
  weekDays,
  weekWorkouts,
  workoutsThisWeek,
  totalWorkoutsInWeek,
  habits,
  todayCompletions,
  weekHabitCompletions,
  habitWeekDays,
  overallStreak,
  rivalry,
  scheduleInfo,
  programWorkoutDays,
}: DashboardClientProps) {
  const colors = useColors()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [activeView, setActiveView] = useState<'agenda' | 'calendar'>('agenda')
  const [completions, setCompletions] = useState<HabitCompletion[]>(todayCompletions)
  const [weekCompletions, setWeekCompletions] = useState<WeekHabitCompletion[]>(weekHabitCompletions)
  const [loading, setLoading] = useState<string | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(scheduleInfo?.needsSchedule ?? false)
  const [currentSchedule, setCurrentSchedule] = useState<number[] | null>(scheduleInfo?.scheduledDays ?? null)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week, 1 = next week
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    // Default to today's index in the week (0 = Monday)
    return habitWeekDays.findIndex(d => d.isToday)
  })
  const [showSkipModal, setShowSkipModal] = useState<string | null>(null) // habit id
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [skippingHabit, setSkippingHabit] = useState(false)

  const supabase = createClient()
  const today = new Date().toLocaleDateString('en-CA')

  // Get selected day info - this will be updated after displayWeekDays is computed
  // For now, use habitWeekDays for current week, will be overridden in calendar view
  const selectedDayFromCurrentWeek = habitWeekDays[selectedDayIndex] || habitWeekDays.find(d => d.isToday) || habitWeekDays[0]

  // Compute workouts for non-current weeks based on scheduled days pattern
  const getWorkoutsForWeekOffset = (offset: number): Record<number, WeekWorkoutInfo> => {
    if (offset === 0) return weekWorkouts

    // For flexible mode, we don't show scheduled workouts for other weeks
    // since there's no fixed schedule - only show completed workouts (handled by server for current week)
    if (scheduleInfo?.isFlexibleMode) return {}

    if (!scheduleInfo?.scheduledDays || !programWorkoutDays || programWorkoutDays.length === 0) return {}

    const sortedSchedule = [...scheduleInfo.scheduledDays].sort((a, b) => a - b)
    const result: Record<number, WeekWorkoutInfo> = {}

    sortedSchedule.forEach((jsDay, scheduleIndex) => {
      const workoutDay = programWorkoutDays[scheduleIndex % programWorkoutDays.length]
      if (workoutDay) {
        // Convert JS day (0=Sun, 1=Mon) to week index (0=Mon, 6=Sun)
        const weekIndex = jsDay === 0 ? 6 : jsDay - 1
        result[weekIndex] = {
          ...workoutDay,
          completed: false, // Future weeks are not completed
        }
      }
    })

    return result
  }

  const displayWeekWorkouts = getWorkoutsForWeekOffset(weekOffset)
  const selectedDayWorkout = displayWeekWorkouts[selectedDayIndex] || null

  // Rivalry display logic: show banner only if tied or losing
  const rivalryStatus = rivalry
    ? rivalry.my_score > rivalry.opponent_score
      ? 'winning'
      : rivalry.my_score < rivalry.opponent_score
        ? 'losing'
        : 'tied'
    : 'none'
  // Show rivalry banner whenever there's an active rivalry (rivalry object only exists when active)
  const showRivalryBanner = !!rivalry

  // Build agenda items
  const agendaItems: Array<{
    id: string
    type: 'workout' | 'habit'
    title: string
    subtitle: string
    icon: string
    color: string
    completed: boolean
    rivalryData?: Rivalry | null
  }> = []

  // Add workout if scheduled for today
  if (todayWorkout) {
    agendaItems.push({
      id: `workout-${todayWorkout.id}`,
      type: 'workout',
      title: todayWorkout.name,
      subtitle: `Week ${todayWorkout.week} · ${todayWorkout.estimatedDuration} min · ${todayWorkout.exerciseCount} exercises`,
      icon: '🏋️',
      color: colors.purple,
      completed: false,
    })
  }

  // Add habits
  habits.forEach(habit => {
    const template = getHabitTemplate(habit)
    const isCompleted = completions.some(c => c.client_habit_id === habit.id)
    const icon = template.category ? habitIcons[template.category] : '✓'

    // Check if this habit has the rivalry
    const hasRivalry = rivalry && rivalry.habit_name === template.name

    agendaItems.push({
      id: habit.id,
      type: 'habit',
      title: template.name,
      subtitle: 'Every day',
      icon,
      color: template.category === 'nutrition' ? colors.green :
        template.category === 'mindset' ? colors.amber :
          template.category === 'fitness' ? colors.purple : colors.green,
      completed: isCompleted,
      rivalryData: hasRivalry ? rivalry : null,
    })
  })

  const completedCount = agendaItems.filter(item => item.completed).length
  const progressPercent = agendaItems.length > 0 ? (completedCount / agendaItems.length) * 100 : 0

  // Handle habit completion
  const handleHabitComplete = async (habitId: string) => {
    if (loading) return
    setLoading(habitId)

    const existingCompletion = completions.find(c => c.client_habit_id === habitId)

    try {
      if (existingCompletion) {
        // Remove completion
        await supabase
          .from('habit_completions')
          .delete()
          .eq('id', existingCompletion.id)

        setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id))
        setWeekCompletions(prev => prev.filter(c => c.id !== existingCompletion.id))
      } else {
        // Add completion
        const { data, error } = await supabase
          .from('habit_completions')
          .insert({
            client_id: userId,
            client_habit_id: habitId,
            completed_date: today,
            value: 1,
          })
          .select()
          .single()

        if (error) throw error

        setCompletions(prev => [...prev, data])
        setWeekCompletions(prev => [...prev, { ...data, completed_date: today }])
      }
    } catch (err) {
      console.error('Error toggling habit completion:', err)
    } finally {
      setLoading(null)
    }
  }

  // Get current date info
  const now = new Date()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const shortDayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const currentDayName = dayNames[now.getDay()]
  const currentMonth = monthNames[now.getMonth()]
  const currentDate = now.getDate()

  // Calculate week days based on offset (for week navigation)
  const getWeekDaysForOffset = (offset: number) => {
    const todayDate = new Date()
    // Get Monday of current week
    const dayOfWeek = todayDate.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(todayDate)
    monday.setDate(todayDate.getDate() - daysFromMonday + (offset * 7))
    monday.setHours(0, 0, 0, 0)

    const days: Array<{
      dayName: string
      dayNum: number
      dateStr: string
      isToday: boolean
      isPast: boolean
      isFuture: boolean
      fullDate: Date
    }> = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const dateStr = date.toLocaleDateString('en-CA')
      const todayStr = todayDate.toLocaleDateString('en-CA')

      days.push({
        dayName: shortDayNames[(date.getDay())], // 0=Sun, but we start Mon
        dayNum: date.getDate(),
        dateStr,
        isToday: dateStr === todayStr,
        isPast: date < new Date(todayStr),
        isFuture: date > new Date(todayStr),
        fullDate: date,
      })
    }
    return days
  }

  const displayWeekDays = weekOffset === 0 ? habitWeekDays.map((d, i) => ({
    ...d,
    dayName: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
    dayNum: weekDays[i]?.dayNum || 0,
    fullDate: new Date(d.dateStr + 'T12:00:00'),
  })) : getWeekDaysForOffset(weekOffset)

  // Get the month/year for the displayed week
  const displayWeekStart = displayWeekDays[0]?.fullDate || now
  const displayWeekEnd = displayWeekDays[6]?.fullDate || now
  const displayMonth = displayWeekStart.getMonth() === displayWeekEnd.getMonth()
    ? monthNames[displayWeekStart.getMonth()]
    : `${monthNames[displayWeekStart.getMonth()].slice(0, 3)}-${monthNames[displayWeekEnd.getMonth()].slice(0, 3)}`
  const displayYear = displayWeekStart.getFullYear()

  // Week navigation handlers
  const goToPrevWeek = () => setWeekOffset(prev => prev - 1)
  const goToNextWeek = () => setWeekOffset(prev => prev + 1)
  const goToCurrentWeek = () => {
    setWeekOffset(0)
    setSelectedDayIndex(habitWeekDays.findIndex(d => d.isToday))
  }

  // Get selected day info based on the displayed week
  const selectedDay = displayWeekDays[selectedDayIndex] || displayWeekDays[0]
  const isSelectedDayToday = selectedDay?.isToday ?? false
  const isSelectedDayPast = selectedDay?.isPast ?? false
  const isSelectedDayFuture = selectedDay?.isFuture ?? false

  // Calculate habits completed for each day (for calendar view)
  const getHabitsStatusForDay = (dateStr: string) => {
    const dayCompletions = weekCompletions.filter(c => c.completed_date === dateStr)
    const total = habits.length
    const completed = new Set(dayCompletions.map(c => c.client_habit_id)).size
    return { completed, total }
  }

  // Get habit completions for the selected day
  const getHabitCompletionsForSelectedDay = () => {
    if (!selectedDay) return []
    return weekCompletions.filter(c => c.completed_date === selectedDay.dateStr)
  }

  const selectedDayCompletions = getHabitCompletionsForSelectedDay()

  // Handle habit completion for a specific date (for calendar view)
  const handleHabitCompleteForDate = async (habitId: string, dateStr: string) => {
    if (loading) return
    setLoading(habitId)

    const existingCompletion = weekCompletions.find(
      c => c.client_habit_id === habitId && c.completed_date === dateStr
    )

    try {
      if (existingCompletion) {
        // Remove completion
        await supabase
          .from('habit_completions')
          .delete()
          .eq('id', existingCompletion.id)

        setWeekCompletions(prev => prev.filter(c => c.id !== existingCompletion.id))
        if (dateStr === today) {
          setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id))
        }
      } else {
        // Add completion
        const { data, error } = await supabase
          .from('habit_completions')
          .insert({
            client_id: userId,
            client_habit_id: habitId,
            completed_date: dateStr,
            value: 1,
          })
          .select()
          .single()

        if (error) throw error

        setWeekCompletions(prev => [...prev, { ...data, completed_date: dateStr }])
        if (dateStr === today) {
          setCompletions(prev => [...prev, data])
        }
      }
    } catch (err) {
      console.error('Error toggling habit completion:', err)
    } finally {
      setLoading(null)
    }
  }

  // Skip habit (mark as skipped - we can track this with a special value or separate table)
  const handleSkipHabit = async (habitId: string) => {
    if (skippingHabit || !selectedDay) return
    setSkippingHabit(true)

    try {
      // For now, we'll just mark it as complete with value 0 to indicate "skipped"
      // In future, you might want a separate skipped_habits table
      const { data, error } = await supabase
        .from('habit_completions')
        .insert({
          client_id: userId,
          client_habit_id: habitId,
          completed_date: selectedDay.dateStr,
          value: 0, // 0 indicates skipped
        })
        .select()
        .single()

      if (error) throw error

      setWeekCompletions(prev => [...prev, { ...data, completed_date: selectedDay.dateStr }])
      if (selectedDay.dateStr === today) {
        setCompletions(prev => [...prev, data])
      }
      setShowSkipModal(null)
    } catch (err) {
      console.error('Error skipping habit:', err)
    } finally {
      setSkippingHabit(false)
    }
  }

  const getRivalryMessage = () => {
    if (rivalryStatus === 'losing') return `${rivalry?.opponent_name} is ahead!`
    if (rivalryStatus === 'tied') return 'Tied! Stay consistent'
    return ''
  }

  // Get day name for selected day
  const selectedDayDate = selectedDay ? new Date(selectedDay.dateStr + 'T12:00:00') : new Date()
  const selectedDayFullName = dayNames[selectedDayDate.getDay()] || 'Today'
  const selectedMonthName = monthNames[selectedDayDate.getMonth()] || ''
  const selectedDateNum = selectedDayDate.getDate()

  return (
    <div className="dashboard-container">
      <style>{`
        @keyframes rivalry-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(249, 115, 22, 0.25); }
          50% { box-shadow: 0 0 25px rgba(249, 115, 22, 0.4); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes habit-complete-fill {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes habit-check-pop {
          0% {
            transform: scale(0) rotate(-45deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.3) rotate(0deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .rivalry-card { animation: rivalry-glow 3s ease-in-out infinite; }
        .rivalry-dot { animation: pulse-dot 2s ease-in-out infinite; }

        .dashboard-container {
          min-height: 100vh;
          background: ${colors.bg};
          padding-bottom: 100px;
        }

        .dashboard-content {
          max-width: 500px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0 24px;
        }

        .header-left {
          display: flex;
          flex-direction: column;
        }

        .greeting {
          font-size: 14px;
          color: ${colors.textMuted};
        }

        .user-name {
          font-size: 28px;
          font-weight: 700;
          color: ${colors.text};
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .notification-btn {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: ${colors.bgCard};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: white;
        }

        /* Rivalry Banner */
        .rivalry-banner {
          background: ${isDark ? colors.bgCard : 'linear-gradient(135deg, #fffaf8 0%, #fff6f2 100%)'};
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }

        .rivalry-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          padding: ${isDark ? '1.5px' : '2px'};
          background: linear-gradient(135deg, #f97316, #fbbf24, #ef4444);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .rivalry-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .rivalry-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: ${isDark ? 'none' : '0 2px 8px rgba(249, 115, 22, 0.3)'};
        }

        .rivalry-info {
          flex: 1;
          min-width: 0;
        }

        .rivalry-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
        }

        .rivalry-title {
          font-size: 13px;
          font-weight: 600;
          color: ${colors.text};
        }

        .rivalry-message {
          font-size: 12px;
          color: ${isDark ? '#fbbf24' : '#f97316'};
          font-weight: 500;
        }

        .rivalry-scores {
          text-align: center;
          flex-shrink: 0;
        }

        .rivalry-score-text {
          font-size: 15px;
          font-weight: 700;
        }

        .rivalry-days {
          font-size: 10px;
          color: ${colors.textMuted};
        }

        /* Agenda Header */
        .agenda-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .agenda-title-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .agenda-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .agenda-title {
          font-size: 18px;
          font-weight: 700;
          color: ${colors.text};
          margin: 0;
        }

        .agenda-date {
          font-size: 12px;
          color: ${colors.textMuted};
        }

        .agenda-count {
          padding: 6px 12px;
          background: ${colors.bgCard};
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: ${colors.textSecondary};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
        }

        /* Progress Bar */
        .progress-bar-container {
          height: 6px;
          background: ${isDark ? colors.bgCard : colors.border};
          border-radius: 3px;
          margin-bottom: 24px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, ${colors.purple} 0%, ${colors.green} 100%);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        /* Agenda Item */
        .agenda-item {
          background: ${colors.bgCard};
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
        }

        .agenda-item.has-rivalry {
          border: 1.5px solid ${isDark ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.5)'};
          box-shadow: ${isDark ? 'none' : '0 2px 8px rgba(249, 115, 22, 0.1)'};
        }

        .agenda-item-content {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .checkbox {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 2px solid ${colors.border};
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          transition: all 0.2s;
        }

        .checkbox.completed {
          background: ${colors.green};
          border-color: ${colors.green};
        }

        .checkbox.loading {
          opacity: 0.5;
        }

        .item-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .item-details {
          flex: 1;
          min-width: 0;
        }

        .item-title {
          font-size: 15px;
          font-weight: 600;
          color: ${colors.text};
          margin-bottom: 2px;
        }

        .item-subtitle {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .start-btn {
          padding: 8px 14px;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          border: none;
          cursor: pointer;
        }

        .add-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: ${colors.bgCardSolid};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* Rivalry Badge on Habit */
        .rivalry-badge {
          margin-top: 10px;
          margin-left: 42px;
          padding: 8px 10px;
          background: ${isDark
            ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%)'
            : 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%)'};
          border-radius: 8px;
          border: 1px solid ${isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.3)'};
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rivalry-badge-text {
          font-size: 11px;
          color: #f97316;
          font-weight: 600;
        }

        .rivalry-badge-score {
          font-size: 11px;
          color: ${colors.textMuted};
        }

        .rivalry-badge-days {
          font-size: 10px;
          color: ${colors.textMuted};
          margin-left: auto;
        }

        /* Streak Card */
        .streak-card {
          background: ${isDark
            ? `linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, ${colors.bgCard} 100%)`
            : 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(255,255,255,1) 100%)'};
          border-radius: 16px;
          padding: 16px;
          margin-top: 8px;
          border: 1px solid ${isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.4)'};
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .streak-icon {
          font-size: 32px;
        }

        .streak-info {
          flex: 1;
        }

        .streak-title {
          font-size: 15px;
          font-weight: 600;
          color: ${colors.text};
        }

        .streak-subtitle {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .streak-count {
          font-size: 24px;
          font-weight: 800;
          color: ${colors.amber};
        }

        /* Calendar View */
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0 20px;
        }

        .calendar-title-section {
          display: flex;
          align-items: center;
        }

        .calendar-title-section h2 {
          font-size: 24px;
          font-weight: 700;
          color: ${colors.text};
          margin: 0;
        }

        /* Week Strip */
        .week-strip {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }

        .week-day-cell {
          flex: 1;
          background: ${colors.bgCard};
          border-radius: 14px;
          padding: 12px 6px;
          text-align: center;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)'};
        }

        .week-day-cell.today {
          background: ${colors.purple};
          border: 2px solid ${colors.purpleLight};
        }

        .week-day-cell.selected {
          background: ${isDark ? colors.bgCardSolid : colors.bgCard};
          border: 2px solid ${colors.purple};
        }

        .week-day-cell:hover:not(.today) {
          border-color: ${colors.purple}80;
        }

        .week-day-name {
          font-size: 10px;
          color: ${colors.textMuted};
          margin-bottom: 4px;
          font-weight: 500;
        }

        .week-day-cell.today .week-day-name {
          color: rgba(255,255,255,0.7);
        }

        .week-day-date {
          font-size: 16px;
          font-weight: 700;
          color: ${colors.text};
          margin-bottom: 8px;
        }

        .week-day-cell.today .week-day-date {
          color: white;
        }

        .week-day-dots {
          display: flex;
          justify-content: center;
          gap: 3px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-dot.workout {
          background: ${colors.purple};
        }

        .status-dot.workout.completed {
          background: ${colors.green};
        }

        .status-dot.workout.today {
          background: white;
        }

        .status-dot.habits {
          background: ${colors.bgCardSolid};
        }

        .status-dot.habits.partial {
          background: ${colors.amber};
        }

        .status-dot.habits.complete {
          background: ${colors.green};
        }

        .status-dot.habits.today-empty {
          background: rgba(255,255,255,0.5);
        }

        /* Legend */
        .legend {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .legend-text {
          font-size: 11px;
          color: ${colors.textMuted};
        }

        /* Today's Details Section */
        .section-label {
          font-size: 12px;
          font-weight: 700;
          color: ${colors.textMuted};
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .workout-detail-card {
          background: ${isDark
            ? `linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, ${colors.bgCard} 100%)`
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, #ffffff 100%)'};
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)'};
        }

        .workout-detail-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .workout-detail-label {
          font-size: 12px;
          font-weight: 600;
          color: ${colors.purple};
        }

        .workout-detail-content {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .workout-detail-info {
          flex: 1;
        }

        .workout-detail-title {
          font-size: 17px;
          font-weight: 700;
          color: ${colors.text};
          margin-bottom: 4px;
        }

        .workout-detail-subtitle {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .workout-start-btn {
          padding: 10px 18px;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          border: none;
          cursor: pointer;
        }

        /* Habits Detail Card */
        .habits-detail-card {
          background: ${colors.bgCard};
          border-radius: 16px;
          padding: 16px;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
        }

        .habits-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .habits-detail-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .habits-detail-label {
          font-size: 12px;
          font-weight: 600;
          color: ${colors.green};
        }

        .habits-detail-count {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .habit-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
        }

        .habit-row:not(:last-child) {
          border-bottom: 1px solid ${colors.border};
        }

        .habit-checkbox {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid ${colors.border};
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .habit-checkbox.completed {
          background: linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%);
          border-color: transparent;
          animation: habit-complete-fill 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3), 0 2px 8px rgba(139, 92, 246, 0.2);
        }

        .habit-checkbox.completed svg {
          animation: habit-check-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
        }

        .habit-checkbox.skipped {
          background: ${colors.textMuted};
          border-color: ${colors.textMuted};
        }

        .habit-icon {
          font-size: 18px;
        }

        .habit-name {
          font-size: 14px;
          color: ${colors.text};
          flex: 1;
        }

        .habit-add-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: ${colors.bgCardSolid};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .skip-btn {
          padding: 6px 12px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid ${colors.border};
          font-size: 12px;
          font-weight: 500;
          color: ${colors.textMuted};
          cursor: pointer;
          transition: all 0.2s;
        }

        .skip-btn:hover {
          border-color: ${colors.amber};
          color: ${colors.amber};
        }

        .reschedule-btn {
          padding: 8px 14px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid ${colors.border};
          font-size: 13px;
          font-weight: 500;
          color: ${colors.textSecondary};
          cursor: pointer;
          transition: all 0.2s;
        }

        .reschedule-btn:hover {
          border-color: ${colors.purple};
          color: ${colors.purple};
        }

        /* Calendar Rivalry Badge */
        .calendar-rivalry-badge {
          margin-left: 36px;
          margin-bottom: 8px;
          padding: 6px 10px;
          background: rgba(249, 115, 22, 0.08);
          border-radius: 6px;
          border: 1px solid rgba(249, 115, 22, 0.2);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .calendar-rivalry-text {
          font-size: 10px;
          color: #f97316;
          font-weight: 600;
        }

        /* Upcoming Section */
        .upcoming-card {
          background: ${colors.bgCard};
          border-radius: 14px;
          padding: 14px 16px;
          border: 1px solid ${colors.border};
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
        }

        .upcoming-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: ${colors.bgCardSolid};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .upcoming-info {
          flex: 1;
        }

        .upcoming-title {
          font-size: 14px;
          font-weight: 600;
          color: ${colors.text};
        }

        .upcoming-date {
          font-size: 12px;
          color: ${colors.textMuted};
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 468px;
          background: ${colors.bgCard};
          border-radius: 20px;
          padding: 12px 20px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 -2px 10px rgba(0,0,0,0.05)'};
          z-index: 100;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          text-decoration: none;
        }

        .nav-label {
          font-size: 10px;
          font-weight: 600;
        }
      `}</style>

      <div className="dashboard-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <span className="greeting">{greeting}</span>
            <h1 className="user-name">{userName.split(' ')[0]}</h1>
          </div>
          <div className="header-actions">
            <div className="notification-btn">
              <NotificationBell userId={userId} />
            </div>
            <div className="avatar">{initials}</div>
          </div>
        </header>

        {/* TODAY'S AGENDA VIEW */}
        {activeView === 'agenda' && (
          <>
            {/* Rivalry Banner */}
            {showRivalryBanner && rivalry && (
              <div className="rivalry-banner rivalry-card">
                <div className="rivalry-banner-content">
                  <div className="rivalry-icon">
                    <Icons.swords size={18} color="white" />
                  </div>
                  <div className="rivalry-info">
                    <div className="rivalry-title-row">
                      <span className="rivalry-title">{rivalry.habit_name}</span>
                      <div className="rivalry-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#f97316' }} />
                    </div>
                    <div className="rivalry-message">{getRivalryMessage()}</div>
                  </div>
                  <div className="rivalry-scores">
                    <div className="rivalry-score-text">
                      <span style={{ color: colors.green }}>{rivalry.my_score}%</span>
                      <span style={{ color: colors.textMuted, margin: '0 4px', fontSize: 12 }}>vs</span>
                      <span style={{ color: '#f97316' }}>{rivalry.opponent_score}%</span>
                    </div>
                    <div className="rivalry-days">{rivalry.days_left}d left</div>
                  </div>
                  <Link href={`/rivalry/${rivalry.id}`}>
                    <Icons.chevronRight size={18} color={colors.textMuted} />
                  </Link>
                </div>
              </div>
            )}

            {/* Agenda Header */}
            <div className="agenda-header">
              <div className="agenda-title-section">
                <div className="agenda-icon">📋</div>
                <div>
                  <h2 className="agenda-title">Today&apos;s Agenda</h2>
                  <div className="agenda-date">{currentDayName}, {currentMonth.slice(0, 3)} {currentDate}</div>
                </div>
              </div>
              <div className="agenda-count">{completedCount}/{agendaItems.length} done</div>
            </div>

            {/* Progress Bar */}
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            {/* Set Schedule Prompt */}
            {scheduleInfo && !currentSchedule && (
              <div
                className="agenda-item"
                onClick={() => setShowScheduleModal(true)}
                style={{ cursor: 'pointer', marginBottom: 16 }}
              >
                <div className="agenda-item-content">
                  <div className="item-icon" style={{ background: `${colors.purple}20` }}>
                    📅
                  </div>
                  <div className="item-details">
                    <div className="item-title">Set Your Workout Schedule</div>
                    <div className="item-subtitle">Pick which days you&apos;ll work out each week</div>
                  </div>
                  <Icons.chevronRight size={20} color={colors.textMuted} />
                </div>
              </div>
            )}

            {/* Agenda Items */}
            {agendaItems.map(item => (
              <div key={item.id} className={`agenda-item ${item.rivalryData ? 'has-rivalry' : ''}`}>
                <div className="agenda-item-content">
                  <div
                    className={`checkbox ${item.completed ? 'completed' : ''} ${loading === item.id ? 'loading' : ''}`}
                    onClick={() => item.type === 'habit' && handleHabitComplete(item.id)}
                  >
                    {item.completed && <Icons.check size={16} color="white" />}
                  </div>
                  <div
                    className="item-icon"
                    style={{ background: isDark ? `${item.color}20` : `${item.color}15` }}
                  >
                    {item.icon}
                  </div>
                  <div className="item-details">
                    <div className="item-title">{item.title}</div>
                    <div className="item-subtitle">{item.subtitle}</div>
                  </div>
                  {item.type === 'workout' && todayWorkout && (
                    <Link href={`/workouts/${todayWorkout.id}`}>
                      <button className="start-btn">Start</button>
                    </Link>
                  )}
                  {item.type === 'habit' && !item.completed && (
                    <button
                      className="add-btn"
                      onClick={() => handleHabitComplete(item.id)}
                      disabled={loading === item.id}
                    >
                      <Icons.plus size={20} color={colors.textSecondary} />
                    </button>
                  )}
                </div>

                {/* Rivalry Badge on Habit */}
                {item.rivalryData && (
                  <div className="rivalry-badge">
                    <span style={{ fontSize: 12 }}>⚔️</span>
                    <span className="rivalry-badge-text">vs {item.rivalryData.opponent_name}</span>
                    <span className="rivalry-badge-score">
                      {item.rivalryData.my_score}%-{item.rivalryData.opponent_score}%
                    </span>
                    <span className="rivalry-badge-days">{item.rivalryData.days_left}d</span>
                  </div>
                )}
              </div>
            ))}

            {/* Streak Card */}
            {overallStreak > 0 && (
              <div className="streak-card">
                <div className="streak-icon">🔥</div>
                <div className="streak-info">
                  <div className="streak-title">Keep your streak alive!</div>
                  <div className="streak-subtitle">Complete all tasks to hit day {overallStreak + 1}</div>
                </div>
                <div className="streak-count">{overallStreak}</div>
              </div>
            )}
          </>
        )}

        {/* CALENDAR VIEW */}
        {activeView === 'calendar' && (
          <>
            {/* Calendar Header */}
            <div className="calendar-header">
              <div className="calendar-title-section">
                <h2>{displayMonth} {displayYear}</h2>
                {weekOffset !== 0 && (
                  <button
                    onClick={goToCurrentWeek}
                    style={{
                      marginLeft: 12,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: colors.purple,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Today
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={goToPrevWeek}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: colors.bgCard,
                    border: isDark ? 'none' : `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Icons.chevronLeft size={20} color={colors.textSecondary} />
                </button>
                <button
                  onClick={goToNextWeek}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: colors.bgCard,
                    border: isDark ? 'none' : `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Icons.chevronRight size={20} color={colors.textSecondary} />
                </button>
              </div>
            </div>

            {/* Rivalry Banner (Compact) */}
            {showRivalryBanner && rivalry && (
              <div className="rivalry-banner rivalry-card" style={{ padding: '12px 14px', marginBottom: 20 }}>
                <div className="rivalry-banner-content" style={{ gap: 10 }}>
                  <div className="rivalry-icon" style={{ width: 36, height: 36 }}>
                    <Icons.swords size={16} color="white" />
                  </div>
                  <div className="rivalry-info">
                    <div className="rivalry-title" style={{ fontSize: 13 }}>{rivalry.habit_name}</div>
                    <div className="rivalry-message" style={{ fontSize: 11 }}>{getRivalryMessage()}</div>
                  </div>
                  <div className="rivalry-scores">
                    <div className="rivalry-score-text" style={{ fontSize: 14 }}>
                      <span style={{ color: colors.green }}>{rivalry.my_score}%</span>
                      <span style={{ color: colors.textMuted, fontSize: 11 }}> vs </span>
                      <span style={{ color: '#f97316' }}>{rivalry.opponent_score}%</span>
                    </div>
                  </div>
                  <Icons.chevronRight size={16} color={colors.textMuted} />
                </div>
              </div>
            )}

            {/* Week Strip */}
            <div className="week-strip">
              {displayWeekDays.map((day, i) => {
                const dateStr = day.dateStr || ''
                const habitStatus = getHabitsStatusForDay(dateStr)
                // Use displayWeekWorkouts which works for any week offset
                const dayWorkout = displayWeekWorkouts[i]
                const hasWorkout = !!dayWorkout
                const isWorkoutCompleted = dayWorkout?.completed || false
                const isSelected = i === selectedDayIndex

                return (
                  <div
                    key={i}
                    className={`week-day-cell ${day.isToday ? 'today' : ''} ${isSelected && !day.isToday ? 'selected' : ''}`}
                    onClick={() => {
                      // Just select the day - don't navigate away from the current week view
                      setSelectedDayIndex(i)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="week-day-name">{day.dayName}</div>
                    <div className="week-day-date">{day.dayNum}</div>
                    <div className="week-day-dots">
                      {hasWorkout && (
                        <div className={`status-dot workout ${isWorkoutCompleted ? 'completed' : ''} ${day.isToday && !isWorkoutCompleted ? 'today' : ''}`} />
                      )}
                      {habits.length > 0 && (
                        <div className={`status-dot habits ${
                          habitStatus.completed === habitStatus.total && habitStatus.total > 0 ? 'complete' :
                            habitStatus.completed > 0 ? 'partial' :
                              day.isToday ? 'today-empty' : ''
                        }`} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="legend">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: colors.purple }} />
                <span className="legend-text">Workout</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: colors.amber }} />
                <span className="legend-text">Habits</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: colors.green }} />
                <span className="legend-text">Done</span>
              </div>
            </div>

            {/* Selected Day's Details */}
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">
                {selectedDayFullName.toUpperCase()}, {selectedMonthName.toUpperCase().slice(0, 3)} {selectedDateNum}
                {isSelectedDayToday && ' — TODAY'}
                {isSelectedDayPast && ' — PAST'}
                {isSelectedDayFuture && ' — UPCOMING'}
              </div>

              {/* Workout Card */}
              {selectedDayWorkout ? (
                <div className="workout-detail-card">
                  <div className="workout-detail-header">
                    <span style={{ fontSize: 14 }}>🏋️</span>
                    <span className="workout-detail-label">WORKOUT</span>
                    {selectedDayWorkout.completed && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.green, fontWeight: 600 }}>✓ DONE</span>
                    )}
                  </div>
                  <div className="workout-detail-content">
                    <div className="workout-detail-info">
                      <div className="workout-detail-title">{selectedDayWorkout.name}</div>
                      <div className="workout-detail-subtitle">
                        Week {selectedDayWorkout.week} · {selectedDayWorkout.estimatedDuration} min · {selectedDayWorkout.exerciseCount} exercises
                      </div>
                    </div>
                    {selectedDayWorkout.completed ? (
                      // Completed workout - just show View button
                      <Link href={`/workouts/${selectedDayWorkout.id}`}>
                        <button className="workout-start-btn">View</button>
                      </Link>
                    ) : isSelectedDayFuture ? (
                      // Future workout - show Reschedule only
                      <button
                        className="reschedule-btn"
                        onClick={() => setShowRescheduleModal(true)}
                      >
                        Reschedule
                      </button>
                    ) : (
                      // Today or past incomplete workout
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!isSelectedDayToday && (
                          <button
                            className="reschedule-btn"
                            onClick={() => setShowRescheduleModal(true)}
                          >
                            Reschedule
                          </button>
                        )}
                        <Link href={`/workouts/${selectedDayWorkout.id}`}>
                          <button className="workout-start-btn">
                            {isSelectedDayToday ? 'Start' : 'View'}
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Habits Card */}
              {habits.length > 0 && (
                <div className="habits-detail-card">
                  <div className="habits-detail-header">
                    <div className="habits-detail-label-row">
                      <span style={{ fontSize: 14 }}>✅</span>
                      <span className="habits-detail-label">HABITS</span>
                    </div>
                    <div className="habits-detail-count">
                      {selectedDayCompletions.filter(c => c.value !== 0).length}/{habits.length} complete
                    </div>
                  </div>

                  {habits.map((habit, i) => {
                    const template = getHabitTemplate(habit)
                    const completion = selectedDayCompletions.find(c => c.client_habit_id === habit.id)
                    const isCompleted = !!completion && completion.value !== 0
                    const isSkipped = !!completion && completion.value === 0
                    const icon = template.category ? habitIcons[template.category] : '✓'
                    const hasRivalry = rivalry && rivalry.habit_name === template.name

                    return (
                      <div key={habit.id}>
                        <div className="habit-row" style={{ borderBottom: i < habits.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                          <div
                            className={`habit-checkbox ${isCompleted ? 'completed' : ''} ${isSkipped ? 'skipped' : ''}`}
                            onClick={() => !isSelectedDayFuture && handleHabitCompleteForDate(habit.id, selectedDay.dateStr)}
                            style={{ cursor: isSelectedDayFuture ? 'not-allowed' : 'pointer' }}
                          >
                            {isCompleted && <Icons.check size={14} color="white" />}
                            {isSkipped && <span style={{ fontSize: 10, color: 'white' }}>—</span>}
                          </div>
                          <span className="habit-icon">{icon}</span>
                          <span className="habit-name" style={{ textDecoration: isSkipped ? 'line-through' : 'none', opacity: isSkipped ? 0.6 : 1 }}>
                            {template.name}
                          </span>
                          {!isCompleted && !isSkipped && !isSelectedDayFuture && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="skip-btn"
                                onClick={() => setShowSkipModal(habit.id)}
                              >
                                Skip
                              </button>
                              <button
                                className="habit-add-btn"
                                onClick={() => handleHabitCompleteForDate(habit.id, selectedDay.dateStr)}
                                disabled={loading === habit.id}
                              >
                                <Icons.plus size={18} color={colors.textMuted} />
                              </button>
                            </div>
                          )}
                          {isSkipped && (
                            <span style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>Skipped</span>
                          )}
                        </div>
                        {hasRivalry && rivalry && (
                          <div className="calendar-rivalry-badge">
                            <span style={{ fontSize: 11 }}>⚔️</span>
                            <span className="calendar-rivalry-text">
                              vs {rivalry.opponent_name} · {rivalry.my_score}%-{rivalry.opponent_score}%
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div
          className="nav-item"
          onClick={() => setActiveView('agenda')}
        >
          <Icons.home size={22} color={activeView === 'agenda' ? colors.purple : colors.textMuted} filled={activeView === 'agenda'} />
          <span className="nav-label" style={{ color: activeView === 'agenda' ? colors.purple : colors.textMuted }}>Home</span>
        </div>
        <div
          className="nav-item"
          onClick={() => setActiveView('calendar')}
        >
          <Icons.calendar size={22} color={activeView === 'calendar' ? colors.purple : colors.textMuted} />
          <span className="nav-label" style={{ color: activeView === 'calendar' ? colors.purple : colors.textMuted }}>Calendar</span>
        </div>
        <Link href="/messages" className="nav-item">
          <Icons.chat size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Messages</span>
        </Link>
        <Link href="/settings" className="nav-item">
          <Icons.user size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Account</span>
        </Link>
      </nav>

      {/* Schedule Modal */}
      {scheduleInfo && (
        <WorkoutScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          assignmentId={scheduleInfo.assignmentId}
          programName={scheduleInfo.programName}
          workoutDaysPerWeek={scheduleInfo.workoutDaysPerWeek}
          cardioDaysPerWeek={scheduleInfo.cardioDaysPerWeek}
          currentSchedule={currentSchedule}
          currentCardioDays={scheduleInfo.scheduledCardioDays}
          onSave={(data) => {
            setCurrentSchedule(data.scheduledDays ?? null)
            setShowScheduleModal(false)
          }}
        />
      )}

      {/* Skip Habit Modal */}
      {showSkipModal && (
        <div className="modal-overlay" onClick={() => setShowSkipModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>Skip Habit?</h3>
            </div>
            <p style={{ margin: '12px 0 20px', fontSize: 14, color: colors.textMuted }}>
              This will mark the habit as skipped for {selectedDayFullName}. Skipped habits don&apos;t count toward your streak.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowSkipModal(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSkipHabit(showSkipModal)}
                disabled={skippingHabit}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: colors.amber,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: skippingHabit ? 0.5 : 1
                }}
              >
                {skippingHabit ? 'Skipping...' : 'Skip'}
              </button>
            </div>
          </div>
          <style>{`
            .modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              padding: 20px;
            }
            .modal-content {
              background: ${colors.bgCard};
              border-radius: 20px;
              padding: 24px;
              width: 100%;
              max-width: 340px;
              border: 1px solid ${colors.border};
            }
          `}</style>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && scheduleInfo && (
        <div className="modal-overlay" onClick={() => setShowRescheduleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>Reschedule Workout</h3>
            </div>
            <p style={{ margin: '12px 0 20px', fontSize: 14, color: colors.textMuted }}>
              To reschedule your workouts, update your weekly workout schedule.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowRescheduleModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRescheduleModal(false)
                  setShowScheduleModal(true)
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%)`,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Edit Schedule
              </button>
            </div>
          </div>
          <style>{`
            .modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              padding: 20px;
            }
            .modal-content {
              background: ${colors.bgCard};
              border-radius: 20px;
              padding: 24px;
              width: 100%;
              max-width: 340px;
              border: 1px solid ${colors.border};
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
