import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AvailableSlot, AvailabilityType } from '@/types/booking'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const coachId = searchParams.get('coachId')
  const date = searchParams.get('date') // YYYY-MM-DD
  const type = (searchParams.get('type') || 'session') as AvailabilityType
  const durationMinutes = parseInt(searchParams.get('duration') || '60')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!coachId || !date) {
    return NextResponse.json(
      { error: 'coachId and date are required' },
      { status: 400 }
    )
  }

  try {
    const targetDate = new Date(date)
    const dayOfWeek = targetDate.getDay()

    // 1. Get templates for this day
    const { data: templates } = await supabase
      .from('coach_availability_templates')
      .select('*')
      .eq('coach_id', coachId)
      .eq('availability_type', type)
      .eq('day_of_week', dayOfWeek)

    // 2. Get overrides for this date
    const { data: overrides } = await supabase
      .from('coach_availability_overrides')
      .select('*')
      .eq('coach_id', coachId)
      .eq('availability_type', type)
      .eq('override_date', date)

    // 3. Get existing bookings for this date
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('coach_id', coachId)
      .eq('status', 'confirmed')
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())

    // 4. Get client's favorite times (if client)
    const { data: clientStats } = await supabase
      .from('client_booking_stats')
      .select('favorite_times')
      .eq('client_id', user.id)
      .eq('coach_id', coachId)
      .single()

    const favoriteTimes = clientStats?.favorite_times || []

    // 5. Calculate available slots
    const slots: AvailableSlot[] = []

    // Check for full-day block
    const fullDayBlock = overrides?.find(
      (o) => o.is_blocked && o.start_time === null
    )
    if (fullDayBlock) {
      return NextResponse.json({ slots: [] })
    }

    // Process each template
    for (const template of templates || []) {
      const [startHour, startMin] = template.start_time.split(':').map(Number)
      const [endHour, endMin] = template.end_time.split(':').map(Number)

      // Generate 30-min interval slots
      let slotStart = new Date(date)
      slotStart.setHours(startHour, startMin, 0, 0)

      const templateEnd = new Date(date)
      templateEnd.setHours(endHour, endMin, 0, 0)

      while (slotStart < templateEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

        // Check if slot end exceeds template end
        if (slotEnd > templateEnd) break

        // Check if slot is blocked by override
        const isBlocked = overrides?.some((o) => {
          if (!o.is_blocked || !o.start_time) return false
          const [oStartH, oStartM] = o.start_time.split(':').map(Number)
          const [oEndH, oEndM] = o.end_time!.split(':').map(Number)
          const overrideStart = new Date(date)
          overrideStart.setHours(oStartH, oStartM, 0, 0)
          const overrideEnd = new Date(date)
          overrideEnd.setHours(oEndH, oEndM, 0, 0)

          return slotStart < overrideEnd && slotEnd > overrideStart
        })

        if (!isBlocked) {
          // Count overlapping bookings
          const overlappingCount = (existingBookings || []).filter((b) => {
            const bStart = new Date(b.starts_at)
            const bEnd = new Date(b.ends_at)
            return slotStart < bEnd && slotEnd > bStart
          }).length

          const maxCapacity = template.max_concurrent_clients
          const availableCapacity = maxCapacity - overlappingCount

          if (availableCapacity > 0) {
            // Check if this is a favorite time
            const slotTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`
            const isFavorite = favoriteTimes.some(
              (ft: { day: number; time: string }) =>
                ft.day === dayOfWeek && ft.time === slotTime
            )

            slots.push({
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              availableCapacity,
              isFavorite,
            })
          }
        }

        // Move to next 30-min slot
        slotStart = new Date(slotStart.getTime() + 30 * 60000)
      }
    }

    // Add extra availability from non-blocked overrides
    for (const override of overrides || []) {
      if (override.is_blocked || !override.start_time) continue

      const [startHour, startMin] = override.start_time.split(':').map(Number)
      const [endHour, endMin] = override.end_time!.split(':').map(Number)

      let slotStart = new Date(date)
      slotStart.setHours(startHour, startMin, 0, 0)

      const overrideEnd = new Date(date)
      overrideEnd.setHours(endHour, endMin, 0, 0)

      while (slotStart < overrideEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)
        if (slotEnd > overrideEnd) break

        const overlappingCount = (existingBookings || []).filter((b) => {
          const bStart = new Date(b.starts_at)
          const bEnd = new Date(b.ends_at)
          return slotStart < bEnd && slotEnd > bStart
        }).length

        const maxCapacity = override.max_concurrent_clients || 2
        const availableCapacity = maxCapacity - overlappingCount

        if (availableCapacity > 0) {
          // Check if already in slots (from template)
          const exists = slots.some(
            (s) => s.startsAt === slotStart.toISOString()
          )
          if (!exists) {
            slots.push({
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              availableCapacity,
            })
          }
        }

        slotStart = new Date(slotStart.getTime() + 30 * 60000)
      }
    }

    // Sort by time
    slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error calculating slots:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate slots' },
      { status: 500 }
    )
  }
}
