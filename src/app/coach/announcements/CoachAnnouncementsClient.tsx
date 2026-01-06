'use client'

import { useState } from 'react'
import { useAnnouncements } from '@/hooks/useAnnouncements'
import { useScheduledMessages } from '@/hooks/useScheduledMessages'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { AnnouncementComposer } from '@/components/announcements/AnnouncementComposer'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Announcement, CreateAnnouncementPayload } from '@/types/messaging'

export function CoachAnnouncementsClient() {
  const [showComposer, setShowComposer] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { announcements, loading, createAnnouncement, deleteAnnouncement, archiveAnnouncement, refetch } = useAnnouncements(true, showArchived)
  const {
    messages: scheduledMessages,
    loading: scheduledLoading,
    createScheduledMessage,
    cancelScheduledMessage,
    sendNow,
    refresh: refreshScheduled
  } = useScheduledMessages('pending')

  // Filter to only show scheduled announcements
  const scheduledAnnouncements = scheduledMessages.filter(m => m.messageType === 'announcement')

  const handleCreate = async (payload: CreateAnnouncementPayload) => {
    const result = await createAnnouncement(payload)
    if (result) {
      setShowComposer(false)
    }
  }

  const handleSchedule = async (payload: CreateAnnouncementPayload, scheduledFor: string) => {
    // For announcements, we store the title + content combined
    const fullContent = payload.title ? `${payload.title}\n\n${payload.content}` : payload.content

    const { error } = await createScheduledMessage({
      messageType: 'announcement',
      content: fullContent,
      scheduledFor,
    })

    if (error) {
      alert(`Failed to schedule announcement: ${error}`)
    } else {
      await refreshScheduled()
      setShowComposer(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      await deleteAnnouncement(id)
    }
  }

  const handleArchive = async (id: string) => {
    await archiveAnnouncement(id, true)
  }

  const handleUnarchive = async (id: string) => {
    await archiveAnnouncement(id, false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-slate-400 mt-1">Broadcast messages to your clients</p>
        </div>
        <Button onClick={() => setShowComposer(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Announcement
        </Button>
      </div>

      {/* Tabs for Active/Archived */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showArchived
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showArchived
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archived
        </button>
      </div>

      {/* Scheduled Announcements - only show on Active tab */}
      {!showArchived && !scheduledLoading && scheduledAnnouncements.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Scheduled Announcements
          </h2>
          <div className="space-y-3">
            {scheduledAnnouncements.map((scheduled) => (
              <div
                key={scheduled.id}
                className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-white whitespace-pre-wrap break-words">
                      {scheduled.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-amber-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Scheduled for {new Date(scheduled.scheduledFor).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        if (confirm('Send this announcement now?')) {
                          const { error } = await sendNow(scheduled.id)
                          if (error) {
                            alert(`Failed to send: ${error}`)
                          } else {
                            await refreshScheduled()
                          }
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors"
                    >
                      Send Now
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Cancel this scheduled announcement?')) {
                          const { error } = await cancelScheduledMessage(scheduled.id)
                          if (error) {
                            alert(`Failed to cancel: ${error}`)
                          } else {
                            await refreshScheduled()
                          }
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (announcements as Announcement[]).length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-lg font-medium">{showArchived ? 'No archived announcements' : 'No announcements yet'}</p>
          <p className="text-sm mt-1">{showArchived ? 'Archived announcements will appear here' : 'Create your first announcement to notify all clients'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(announcements as Announcement[]).map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              isCoach={true}
              onDelete={handleDelete}
              onArchive={showArchived ? undefined : handleArchive}
              onUnarchive={showArchived ? handleUnarchive : undefined}
            />
          ))}
        </div>
      )}

      {/* Composer modal */}
      <Modal isOpen={showComposer} onClose={() => setShowComposer(false)} title="New Announcement" size="lg">
        <AnnouncementComposer
          onSubmit={handleCreate}
          onSchedule={handleSchedule}
          onCancel={() => setShowComposer(false)}
        />
      </Modal>
    </div>
  )
}
