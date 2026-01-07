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

  if (!date) {
    return NextResponse.json(
      { error: 'date is required' },
      { status: 400 }
    )
  }

  // Use provided coachId, or if user is a coach, use their own ID
  let targetCoachId = coachId
  if (!targetCoachId) {
    // Check if user is a coach - if so, use their ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'coach') {
      targetCoachId = user.id
    } else {
      return NextResponse.json(
        { error: 'coachId is required for clients' },
        { status: 400 }
      )
    }
  }

  try {
    // Parse date as local date to avoid timezone issues
    // date format is YYYY-MM-DD
    const [year, month, day] = date.split('-').map(Number)
    const targetDate = new Date(year, month - 1, day) // month is 0-indexed
    const dayOfWeek = targetDate.getDay()

    // 1. Get templates for this day
    const { data: templates } = await supabase
      .from('coach_availability_templates')
      .select('*')
      .eq('coach_id', targetCoachId)
      .eq('availability_type', type)
      .eq('day_of_week', dayOfWeek)

    // 2. Get overrides for this date
    // We get overrides for THIS type, plus any BLOCKED overrides from other types
    // (since a blocked day means the coach is unavailable regardless of type)
    const { data: typeOverrides } = await supabase
      .from('coach_availability_overrides')
      .select('*')
      .eq('coach_id', targetCoachId)
      .eq('availability_type', type)
      .eq('override_date', date)

    // Also get blocked overrides from other types
    const { data: blockedOverrides } = await supabase
      .from('coach_availability_overrides')
      .select('*')
      .eq('coach_id', targetCoachId)
      .neq('availability_type', type)
      .eq('override_date', date)
      .eq('is_blocked', true)

    // Combine both sets of overrides
    const overrides = [...(typeOverrides || []), ...(blockedOverrides || [])]

    // 3. Get existing bookings for this date
    // IMPORTANT: We get ALL confirmed bookings (both sessions and check-ins)
    // regardless of the type being queried. This ensures that:
    // - Check-in slots respect training session bookings
    // - Training session slots respect check-in bookings
    // The coach can only be in one place at a time!
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0)
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999)

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('starts_at, ends_at, booking_type')
      .eq('coach_id', targetCoachId)
      .eq('status', 'confirmed')
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())

    // 4. Get client's favorite times (if client)
    const { data: clientStats } = await supabase
      .from('client_booking_stats')
      .select('favorite_times')
      .eq('client_id', user.id)
      .eq('coach_id', targetCoachId)
      .single()

    const favoriteTimes = clientStats?.favorite_times || []

    // Debug: Log what we found
    console.log('Slots API Debug:', {
      date,
      dayOfWeek,
      type,
      targetCoachId,
      templatesFound: templates?.length || 0,
      templates: templates?.map(t => ({ day: t.day_of_week, start: t.start_time, end: t.end_time })),
      overridesFound: overrides?.length || 0,
      overrides: overrides?.map(o => ({ type: o.availability_type, blocked: o.is_blocked, start: o.start_time, end: o.end_time })),
    })

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
      let slotStart = new Date(year, month - 1, day, startHour, startMin, 0, 0)
      const templateEnd = new Date(year, month - 1, day, endHour, endMin, 0, 0)

      while (slotStart < templateEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

        // Check if slot end exceeds template end
        if (slotEnd > templateEnd) break

        // Check if slot is blocked by override
        const isBlocked = overrides?.some((o) => {
          if (!o.is_blocked || !o.start_time) return false
          const [oStartH, oStartM] = o.start_time.split(':').map(Number)
          const [oEndH, oEndM] = o.end_time!.split(':').map(Number)
          const overrideStart = new Date(year, month - 1, day, oStartH, oStartM, 0, 0)
          const overrideEnd = new Date(year, month - 1, day, oEndH, oEndM, 0, 0)

          return slotStart < overrideEnd && slotEnd > overrideStart
        })

        if (!isBlocked) {
          // Check for ANY overlapping booking of a DIFFERENT type - these fully block the slot
          // (e.g., a training session blocks check-in availability and vice versa)
          const hasCrossTypeBooking = (existingBookings || []).some((b) => {
            const bStart = new Date(b.starts_at)
            const bEnd = new Date(b.ends_at)
            const overlaps = slotStart < bEnd && slotEnd > bStart
            return overlaps && b.booking_type !== type
          })

          if (hasCrossTypeBooking) {
            // Skip this slot - coach is busy with a different type of appointment
            slotStart = new Date(slotStart.getTime() + 30 * 60000)
            continue
          }

          // Count overlapping bookings of the SAME type (for concurrent client limits)
          const overlappingCount = (existingBookings || []).filter((b) => {
            const bStart = new Date(b.starts_at)
            const bEnd = new Date(b.ends_at)
            return slotStart < bEnd && slotEnd > bStart && b.booking_type === type
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

      let slotStart = new Date(year, month - 1, day, startHour, startMin, 0, 0)
      const overrideEnd = new Date(year, month - 1, day, endHour, endMin, 0, 0)

      while (slotStart < overrideEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)
        if (slotEnd > overrideEnd) break

        // Check for cross-type bookings that fully block this slot
        const hasCrossTypeBooking = (existingBookings || []).some((b) => {
          const bStart = new Date(b.starts_at)
          const bEnd = new Date(b.ends_at)
          const overlaps = slotStart < bEnd && slotEnd > bStart
          return overlaps && b.booking_type !== type
        })

        if (hasCrossTypeBooking) {
          slotStart = new Date(slotStart.getTime() + 30 * 60000)
          continue
        }

        // Count same-type bookings for concurrent limits
        const overlappingCount = (existingBookings || []).filter((b) => {
          const bStart = new Date(b.starts_at)
          const bEnd = new Date(b.ends_at)
          return slotStart < bEnd && slotEnd > bStart && b.booking_type === type
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

    return NextResponse.json({
      slots,
      _debug: {
        date,
        dayOfWeek,
        type,
        templatesFound: templates?.length || 0,
        templates: templates?.map(t => ({
          day: t.day_of_week,
          start: t.start_time,
          end: t.end_time,
          type: t.availability_type
        })),
      }
    })
  } catch (error) {
    console.error('Error calculating slots:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate slots' },
      { status: 500 }
    )
  }
}
