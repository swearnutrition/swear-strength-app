import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { HabitDetail } from './HabitDetail'

interface PageProps {
  params: Promise<{ habitId: string }>
}

export default async function HabitDetailPage({ params }: PageProps) {
  const { habitId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the habit with template info
  const { data: habit } = await supabase
    .from('client_habits')
    .select(`
      id,
      start_date,
      custom_target_value,
      custom_target_unit,
      habit_templates(
        name,
        description,
        target_value,
        target_unit,
        category,
        frequency
      )
    `)
    .eq('id', habitId)
    .eq('client_id', user.id)
    .single()

  if (!habit) {
    notFound()
  }

  // Get all completions for this habit (past year)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const { data: completions } = await supabase
    .from('habit_completions')
    .select('id, completed_date, value')
    .eq('client_habit_id', habitId)
    .gte('completed_date', oneYearAgo.toLocaleDateString('en-CA'))
    .order('completed_date', { ascending: true })

  // Calculate stats
  const completionDates = new Set((completions || []).map(c => c.completed_date))
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone

  // Total count
  const totalCount = completions?.length || 0

  // Current streak
  let currentStreak = 0
  const checkDate = new Date(today)
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toLocaleDateString('en-CA')
    if (completionDates.has(dateStr)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (i === 0) {
      // Today not complete yet, check from yesterday
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  // Longest streak
  let longestStreak = 0
  let tempStreak = 0
  const sortedDates = [...completionDates].sort()

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

  // Completion rate (since start date)
  const startDate = new Date(habit.start_date)
  const daysSinceStart = Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  const completionRate = Math.round((totalCount / daysSinceStart) * 100)

  // Generate year grid data (52 weeks x 7 days)
  const yearData: { date: string; completed: boolean }[] = []
  const startOfYear = new Date(today)
  startOfYear.setDate(startOfYear.getDate() - 364) // Go back ~1 year
  // Adjust to start on Sunday
  startOfYear.setDate(startOfYear.getDate() - startOfYear.getDay())

  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(startOfYear)
      date.setDate(startOfYear.getDate() + (week * 7) + day)
      const dateStr = date.toLocaleDateString('en-CA')

      yearData.push({
        date: dateStr,
        completed: completionDates.has(dateStr),
      })
    }
  }

  // Get month labels
  const months: { label: string; week: number }[] = []
  let lastMonth = -1
  for (let week = 0; week < 53; week++) {
    const date = new Date(startOfYear)
    date.setDate(startOfYear.getDate() + (week * 7))
    const month = date.getMonth()
    if (month !== lastMonth) {
      months.push({
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        week,
      })
      lastMonth = month
    }
  }

  return (
    <HabitDetail
      habit={habit}
      stats={{
        currentStreak,
        longestStreak,
        totalCount,
        completionRate: Math.min(100, completionRate),
      }}
      yearData={yearData}
      months={months}
    />
  )
}
