'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAvailability } from '@/hooks/useAvailability'
import type { AvailableSlot, BookingType } from '@/types/booking'

interface SlotPickerProps {
  coachId: string
  selectedDate: Date
  bookingType: BookingType
  duration: number
  multiSelect: boolean
  selectedSlots: string[]
  onSlotsChange: (slots: string[]) => void
  maxSelections?: number
  showFavorites?: boolean
  favoriteTimes?: Array<{ day: number; time: string }>
  className?: string
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function SlotPicker({
  coachId,
  selectedDate,
  bookingType,
  duration,
  multiSelect,
  selectedSlots,
  onSlotsChange,
  maxSelections,
  showFavorites = false,
  favoriteTimes = [],
  className = '',
}: SlotPickerProps) {
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { getAvailableSlots } = useAvailability({
    coachId,
    type: bookingType,
  })

  // Fetch available slots when date changes
  const fetchSlots = useCallback(async () => {
    if (!coachId || !selectedDate) return

    setLoading(true)
    setError(null)

    try {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const slots = await getAvailableSlots(dateStr, duration)

      // Mark favorite times if enabled
      const slotsWithFavorites = slots.map((slot) => {
        if (!showFavorites || favoriteTimes.length === 0) {
          return slot
        }

        const slotDate = new Date(slot.startsAt)
        const dayOfWeek = slotDate.getDay()
        const slotTime = slotDate.toTimeString().slice(0, 5) // "HH:MM"

        const isFavorite = favoriteTimes.some(
          (fav) => fav.day === dayOfWeek && fav.time === slotTime
        )

        return { ...slot, isFavorite }
      })

      setAvailableSlots(slotsWithFavorites)
    } catch (err) {
      console.error('Error fetching slots:', err)
      setError('Failed to load available time slots')
      setAvailableSlots([])
    } finally {
      setLoading(false)
    }
  }, [coachId, selectedDate, duration, getAvailableSlots, showFavorites, favoriteTimes])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  // Handle slot selection/deselection
  const handleSlotClick = useCallback(
    (slot: AvailableSlot) => {
      const slotId = slot.startsAt
      const isSelected = selectedSlots.includes(slotId)

      if (isSelected) {
        // Deselect the slot
        onSlotsChange(selectedSlots.filter((s) => s !== slotId))
      } else {
        // Select the slot
        if (!multiSelect) {
          // Single select mode
          onSlotsChange([slotId])
        } else {
          // Multi select mode
          if (maxSelections && selectedSlots.length >= maxSelections) {
            // At max capacity, don't add more
            return
          }
          onSlotsChange([...selectedSlots, slotId])
        }
      }
    },
    [selectedSlots, onSlotsChange, multiSelect, maxSelections]
  )

  // Get slot data for a selected slot ID
  const getSlotData = useMemo(() => {
    const slotMap = new Map<string, AvailableSlot>()
    availableSlots.forEach((slot) => {
      slotMap.set(slot.startsAt, slot)
    })
    return slotMap
  }, [availableSlots])

  // Check if slot can be selected
  const canSelectSlot = useCallback(
    (slotId: string): boolean => {
      if (selectedSlots.includes(slotId)) return true // Can always deselect
      if (!multiSelect && selectedSlots.length > 0) return false // Single select with one selected
      if (maxSelections && selectedSlots.length >= maxSelections) return false
      return true
    },
    [selectedSlots, multiSelect, maxSelections]
  )

  // Loading state
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <svg
          className="animate-spin h-6 w-6 text-purple-500"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchSlots}
          className="mt-3 text-purple-400 hover:text-purple-300 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    )
  }

  // Empty state
  if (availableSlots.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
          <svg
            className="w-6 h-6 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-slate-400">No available slots for this date</p>
        <p className="text-slate-500 text-sm mt-1">Try selecting a different date</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Slot grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {availableSlots.map((slot) => {
          const isSelected = selectedSlots.includes(slot.startsAt)
          const canSelect = canSelectSlot(slot.startsAt)
          const showFavoriteIndicator = showFavorites && slot.isFavorite

          return (
            <button
              key={slot.startsAt}
              type="button"
              onClick={() => handleSlotClick(slot)}
              disabled={!canSelect && !isSelected}
              className={`
                relative py-3 px-2 rounded-xl text-sm font-medium transition-all
                ${
                  isSelected
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-lg shadow-purple-500/25'
                    : canSelect
                      ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-slate-600'
                      : 'bg-slate-800/30 text-slate-500 cursor-not-allowed border border-slate-800'
                }
              `}
            >
              {formatTime(slot.startsAt)}
              {showFavoriteIndicator && (
                <span className="absolute top-1 right-1 text-amber-400 text-xs">
                  ★
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selection info */}
      {multiSelect && maxSelections && (
        <div className="mt-3 text-center">
          <span className="text-slate-500 text-sm">
            {selectedSlots.length} / {maxSelections} slots selected
          </span>
        </div>
      )}

      {/* Legend for favorites */}
      {showFavorites && favoriteTimes.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-amber-400">★</span>
            Your favorite times
          </div>
        </div>
      )}
    </div>
  )
}

// Export helper to get slot data from startsAt timestamp
export function useSlotData(
  slots: string[],
  availableSlots: AvailableSlot[]
): AvailableSlot[] {
  return useMemo(() => {
    const slotMap = new Map<string, AvailableSlot>()
    availableSlots.forEach((slot) => {
      slotMap.set(slot.startsAt, slot)
    })
    return slots
      .map((slotId) => slotMap.get(slotId))
      .filter((slot): slot is AvailableSlot => slot !== undefined)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [slots, availableSlots])
}
