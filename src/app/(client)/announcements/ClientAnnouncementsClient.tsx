'use client'

import { useAnnouncements } from '@/hooks/useAnnouncements'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import type { ClientAnnouncement } from '@/types/messaging'

export function ClientAnnouncementsClient() {
  const { announcements, loading, markAsRead } = useAnnouncements(false)

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <p className="text-slate-400 mt-1">Updates from your coach</p>
      </div>

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (announcements as ClientAnnouncement[]).length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-lg font-medium">No announcements</p>
          <p className="text-sm mt-1">Your coach hasn't posted any announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(announcements as ClientAnnouncement[]).map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              isCoach={false}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}
