'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useNotifications, Notification } from '@/hooks/useNotifications'
import { useColors } from '@/hooks/useColors'

interface NotificationBellProps {
  userId: string
}

const notificationIcons: Record<Notification['type'], string> = {
  nudge: '👊',
  new_program: '📋',
  new_habit: '🎯',
  schedule_reminder: '📅',
  system: '🔔',
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const colors = useColors()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  const getNotificationLink = (notification: Notification): string | null => {
    switch (notification.type) {
      case 'nudge':
        return '/habits'
      case 'new_program':
        return notification.programId ? `/workouts` : '/dashboard'
      case 'new_habit':
        return '/habits'
      case 'schedule_reminder':
        return '/dashboard'
      default:
        return null
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: colors.cardLight,
          border: `1px solid ${colors.border}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Notifications"
      >
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.textSecondary}
          strokeWidth={2}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '20px',
              height: '20px',
              borderRadius: '10px',
              background: colors.red,
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '52px',
            right: 0,
            width: '320px',
            maxHeight: '400px',
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.purple,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Quick Link to Announcements */}
          <Link
            href="/announcements"
            onClick={() => setIsOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderBottom: `1px solid ${colors.border}`,
              textDecoration: 'none',
              background: `${colors.purple}08`,
            }}
          >
            <span style={{ fontSize: '18px' }}>📢</span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.textPrimary }}>
              Coach Announcements
            </span>
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.textMuted}
              strokeWidth={2}
              style={{ marginLeft: 'auto' }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>

          {/* Notifications List */}
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: '14px',
                }}
              >
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map((notification) => {
                const link = getNotificationLink(notification)
                const content = (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      cursor: 'pointer',
                      background: notification.read ? 'transparent' : `${colors.purple}10`,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>
                      {notificationIcons[notification.type]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          fontWeight: notification.read ? 400 : 600,
                          color: colors.textPrimary,
                        }}
                      >
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p
                          style={{
                            margin: '4px 0 0',
                            fontSize: '13px',
                            color: colors.textSecondary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notification.message}
                        </p>
                      )}
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}
                      >
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '4px',
                          background: colors.purple,
                          flexShrink: 0,
                          marginTop: '6px',
                        }}
                      />
                    )}
                  </div>
                )

                return link ? (
                  <Link key={notification.id} href={link} style={{ textDecoration: 'none' }}>
                    {content}
                  </Link>
                ) : (
                  content
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
