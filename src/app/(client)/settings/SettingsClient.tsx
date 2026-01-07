'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { useColors } from '@/hooks/useColors'
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, checkPushPermission, requestPushPermission } from '@/lib/push-notifications'

type WeightUnit = 'lbs' | 'kg'

interface Profile {
  id: string
  name: string
  email: string
  avatar_url: string | null
  preferred_weight_unit: WeightUnit
  timezone: string | null
  created_at: string
  email_nudges: boolean
  email_weekly_summary: boolean
  push_booking_reminders: boolean
  client_type: 'online' | 'training' | 'hybrid' | null
}

// Convert HEIC/HEIF to JPEG
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default

  const blob = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.85,
  }) as Blob

  return new File([blob], file.name.replace(/\.(heic|heif|dng)$/i, '.jpg'), {
    type: 'image/jpeg',
  })
}

// Resize image to max dimensions
async function resizeImage(file: File, maxSize: number = 400): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let { width, height } = img

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          } else {
            reject(new Error('Failed to resize image'))
          }
        },
        'image/jpeg',
        0.85
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// Common timezones grouped by region
const TIMEZONE_OPTIONS = [
  { group: 'United States', timezones: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'America/Honolulu', label: 'Hawaii Time (HT)' },
  ]},
  { group: 'Europe', timezones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  ]},
  { group: 'Australia', timezones: [
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
  ]},
  { group: 'Asia', timezones: [
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  ]},
]

interface SettingsClientProps {
  profile: Profile
  coachName: string | null
  userEmail: string
}

// Icons component
const Icons = {
  home: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  chevronLeft: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  chevronRight: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  camera: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  moon: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  sun: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  monitor: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  logOut: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  mail: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  bell: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
}

export function SettingsClient({ profile, coachName, userEmail }: SettingsClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const colors = useColors()
  const isDark = resolvedTheme === 'dark'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(profile.name)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.preferred_weight_unit)
  const [timezone, setTimezone] = useState(profile.timezone || 'America/New_York')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url)
  const [emailNudges, setEmailNudges] = useState(profile.email_nudges ?? true)
  const [emailWeeklySummary, setEmailWeeklySummary] = useState(profile.email_weekly_summary ?? true)
  const [pushBookingReminders, setPushBookingReminders] = useState(profile.push_booking_reminders ?? true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(true)
  const [pushSupported, setPushSupported] = useState(true)
  const [pushError, setPushError] = useState<string | null>(null)
  const [groupNotificationsEnabled, setGroupNotificationsEnabled] = useState(true)
  const [groupNotificationsLoading, setGroupNotificationsLoading] = useState(false)

  // Check push notification status on mount
  useEffect(() => {
    const checkPushStatus = async () => {
      // Check basic support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushSupported(false)
        setPushLoading(false)
        return
      }

      // Check if Notification API exists
      if (!('Notification' in window)) {
        setPushSupported(false)
        setPushLoading(false)
        return
      }

      try {
        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready
        const permission = await checkPushPermission()

        if (permission === 'granted') {
          const subscription = await registration.pushManager.getSubscription()
          setPushEnabled(!!subscription)
        } else if (permission === 'denied') {
          setPushError('Notifications are blocked. Enable them in your browser settings.')
        }
      } catch (err) {
        console.error('Error checking push status:', err)
      }
      setPushLoading(false)
    }
    checkPushStatus()
  }, [])

  const handleTogglePush = async () => {
    setPushLoading(true)
    setPushError(null)
    try {
      if (pushEnabled) {
        await unsubscribeFromPushNotifications()
        setPushEnabled(false)
      } else {
        // First request permission
        const granted = await requestPushPermission()
        if (!granted) {
          setPushError('Permission denied. Enable notifications in browser settings.')
          setPushLoading(false)
          return
        }

        // Then subscribe
        const subscription = await subscribeToPushNotifications()
        if (subscription) {
          setPushEnabled(true)
        } else {
          setPushError('Failed to enable notifications. Try refreshing the page.')
        }
      }
    } catch (err) {
      console.error('Error toggling push notifications:', err)
      setPushError('Something went wrong. Please try again.')
    }
    setPushLoading(false)
  }

  // Check group notification status on mount
  useEffect(() => {
    const checkGroupNotifications = async () => {
      try {
        const res = await fetch('/api/group-chats/notifications')
        if (res.ok) {
          const data = await res.json()
          setGroupNotificationsEnabled(data.enabled)
        }
      } catch (err) {
        console.error('Error checking group notification status:', err)
      }
    }
    checkGroupNotifications()
  }, [])

  const handleToggleGroupNotifications = async () => {
    setGroupNotificationsLoading(true)
    try {
      const res = await fetch('/api/group-chats/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !groupNotificationsEnabled }),
      })
      if (res.ok) {
        setGroupNotificationsEnabled(!groupNotificationsEnabled)
      }
    } catch (err) {
      console.error('Error toggling group notifications:', err)
    }
    setGroupNotificationsLoading(false)
  }

  // Get initials for avatar
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      await supabase
        .from('profiles')
        .update({
          name,
          preferred_weight_unit: weightUnit,
          timezone,
          email_nudges: emailNudges,
          email_weekly_summary: emailWeeklySummary,
          push_booking_reminders: pushBookingReminders,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch (err) {
      console.error('Error saving profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    setPhotoError(null)

    try {
      let processedFile = file

      const isHeic = /\.(heic|heif|dng)$/i.test(file.name) ||
        file.type === 'image/heic' ||
        file.type === 'image/heif'

      if (isHeic) {
        processedFile = await convertHeicToJpeg(file)
      }

      processedFile = await resizeImage(processedFile, 400)

      const fileExt = 'jpg'
      const fileName = `${profile.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, processedFile, {
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: urlWithTimestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setAvatarUrl(urlWithTimestamp)
      router.refresh()
    } catch (err) {
      console.error('Photo upload error:', err)
      setPhotoError(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const hasChanges = name !== profile.name ||
    weightUnit !== profile.preferred_weight_unit ||
    timezone !== (profile.timezone || 'America/New_York') ||
    emailNudges !== (profile.email_nudges ?? true) ||
    emailWeeklySummary !== (profile.email_weekly_summary ?? true) ||
    pushBookingReminders !== (profile.push_booking_reminders ?? true)

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="account-container">
      <style>{`
        .account-container {
          min-height: 100vh;
          background: ${colors.bg};
          padding-bottom: 100px;
        }

        .account-content {
          max-width: 500px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 24px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${colors.bgCard};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: ${colors.text};
          margin: 0;
        }

        .save-btn {
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          color: white;
        }

        .save-btn:disabled {
          opacity: 0.5;
        }

        .save-btn.saved {
          background: ${colors.green};
        }

        /* Profile Card */
        .profile-card {
          background: ${colors.bgCard};
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 16px;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .avatar-container {
          position: relative;
        }

        .avatar {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          object-fit: cover;
        }

        .avatar-placeholder {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: 700;
        }

        .avatar-edit-btn {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 28px;
          height: 28px;
          border-radius: 10px;
          background: ${colors.purple};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 2px solid ${colors.bg};
        }

        .avatar-edit-btn:disabled {
          opacity: 0.5;
        }

        .profile-info {
          flex: 1;
        }

        .profile-name {
          font-size: 20px;
          font-weight: 700;
          color: ${colors.text};
          margin-bottom: 4px;
        }

        .profile-email {
          font-size: 14px;
          color: ${colors.textMuted};
        }

        .photo-error {
          font-size: 12px;
          color: ${colors.red};
          margin-top: 4px;
        }

        /* Form Section */
        .form-section {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: ${colors.textSecondary};
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          background: ${colors.bgCardSolid};
          border: 1px solid ${colors.border};
          color: ${colors.text};
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          border-color: ${colors.purple};
        }

        /* Toggle Buttons */
        .toggle-group {
          display: flex;
          gap: 8px;
        }

        .toggle-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          color: white;
        }

        .toggle-btn.inactive {
          background: ${colors.bgCardSolid};
          color: ${colors.textSecondary};
          border: 1px solid ${colors.border};
        }

        /* Select */
        .form-select {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          background: ${colors.bgCardSolid};
          border: 1px solid ${colors.border};
          color: ${colors.text};
          font-size: 15px;
          outline: none;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23${isDark ? '6b6880' : '8b85ad'}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 18px;
        }

        .form-hint {
          font-size: 12px;
          color: ${colors.textMuted};
          margin-top: 6px;
        }

        /* Settings Card */
        .settings-card {
          background: ${colors.bgCard};
          border-radius: 16px;
          margin-bottom: 16px;
          border: 1px solid ${colors.border};
          overflow: hidden;
          box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
        }

        .settings-title {
          font-size: 12px;
          font-weight: 600;
          color: ${colors.textMuted};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 16px 16px 12px;
        }

        /* Theme Selector */
        .theme-selector {
          display: flex;
          gap: 8px;
          padding: 0 16px 16px;
        }

        .theme-btn {
          flex: 1;
          padding: 14px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .theme-btn.active {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          color: white;
        }

        .theme-btn.inactive {
          background: ${colors.bgCardSolid};
          color: ${colors.textSecondary};
          border: 1px solid ${colors.border};
        }

        /* Info Row */
        .info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid ${colors.border};
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .info-value {
          font-size: 14px;
          font-weight: 600;
          color: ${colors.text};
        }

        /* Toggle Switch */
        .toggle-switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid ${colors.border};
        }

        .toggle-switch-row:last-child {
          border-bottom: none;
        }

        .toggle-switch-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toggle-switch-label {
          font-size: 14px;
          font-weight: 500;
          color: ${colors.text};
        }

        .toggle-switch-desc {
          font-size: 12px;
          color: ${colors.textMuted};
        }

        .toggle-switch {
          position: relative;
          width: 48px;
          height: 28px;
          background: ${colors.bgCardSolid};
          border-radius: 14px;
          cursor: pointer;
          transition: background 0.2s;
          border: 1px solid ${colors.border};
          flex-shrink: 0;
        }

        .toggle-switch.on {
          background: ${colors.green};
          border-color: ${colors.green};
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .toggle-switch.on::after {
          transform: translateX(20px);
        }

        .coach-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: ${isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(124, 58, 237, 0.1)'};
          border-radius: 20px;
        }

        .coach-badge-text {
          font-size: 14px;
          font-weight: 600;
          color: ${colors.purple};
        }

        /* Sign Out */
        .signout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          background: ${colors.bgCard};
          color: ${colors.red};
          border: 1px solid ${colors.border};
          margin-bottom: 16px;
        }

        .signout-btn:hover {
          background: ${isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'};
        }

        .signout-btn:disabled {
          opacity: 0.5;
        }

        /* App Version */
        .app-version {
          text-align: center;
          font-size: 12px;
          color: ${colors.textMuted};
          padding: 8px 0;
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

      <div className="account-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <Link href="/dashboard" className="back-btn">
              <Icons.chevronLeft size={20} color={colors.textSecondary} />
            </Link>
            <h1 className="page-title">Account</h1>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`save-btn ${saved ? 'saved' : ''}`}
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
          )}
        </header>

        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-header">
            <div className="avatar-container">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="avatar" />
              ) : (
                <div className="avatar-placeholder">{initials}</div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="avatar-edit-btn"
              >
                {uploadingPhoto ? (
                  <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Icons.camera size={14} color="white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif,.dng"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </div>
            <div className="profile-info">
              <div className="profile-name">{name}</div>
              <div className="profile-email">{userEmail}</div>
              {photoError && <div className="photo-error">{photoError}</div>}
            </div>
          </div>

          {/* Name Input */}
          <div className="form-section">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Weight Unit */}
          <div className="form-section">
            <label className="form-label">Preferred Weight Unit</label>
            <div className="toggle-group">
              <button
                onClick={() => setWeightUnit('lbs')}
                className={`toggle-btn ${weightUnit === 'lbs' ? 'active' : 'inactive'}`}
              >
                Pounds (lbs)
              </button>
              <button
                onClick={() => setWeightUnit('kg')}
                className={`toggle-btn ${weightUnit === 'kg' ? 'active' : 'inactive'}`}
              >
                Kilograms (kg)
              </button>
            </div>
          </div>

          {/* Timezone */}
          <div className="form-section" style={{ marginBottom: 0 }}>
            <label className="form-label">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="form-select"
            >
              {TIMEZONE_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="form-hint">Used for scheduling reminders at the right time</p>
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-card">
          <div className="settings-title">Appearance</div>
          <div className="theme-selector">
            <button
              onClick={() => setTheme('dark')}
              className={`theme-btn ${theme === 'dark' ? 'active' : 'inactive'}`}
            >
              <Icons.moon size={18} color={theme === 'dark' ? 'white' : colors.textSecondary} />
              Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`theme-btn ${theme === 'light' ? 'active' : 'inactive'}`}
            >
              <Icons.sun size={18} color={theme === 'light' ? 'white' : colors.textSecondary} />
              Light
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`theme-btn ${theme === 'system' ? 'active' : 'inactive'}`}
            >
              <Icons.monitor size={18} color={theme === 'system' ? 'white' : colors.textSecondary} />
              Auto
            </button>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="settings-card">
          <div className="settings-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.mail size={14} color={colors.textMuted} />
            Email Notifications
          </div>
          <div className="toggle-switch-row">
            <div className="toggle-switch-content">
              <span className="toggle-switch-label">Rivalry Nudges</span>
              <span className="toggle-switch-desc">When your rival sends a nudge</span>
            </div>
            <div
              className={`toggle-switch ${emailNudges ? 'on' : ''}`}
              onClick={() => setEmailNudges(!emailNudges)}
            />
          </div>
          <div className="toggle-switch-row">
            <div className="toggle-switch-content">
              <span className="toggle-switch-label">Weekly Summary</span>
              <span className="toggle-switch-desc">Your weekly stats and progress</span>
            </div>
            <div
              className={`toggle-switch ${emailWeeklySummary ? 'on' : ''}`}
              onClick={() => setEmailWeeklySummary(!emailWeeklySummary)}
            />
          </div>
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${colors.border}` }}>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>
              Coaching emails (reminders, check-ins) are always enabled as part of your program.
            </p>
          </div>
        </div>

        {/* Push Notifications */}
        {pushSupported && (
          <div className="settings-card">
            <div className="settings-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.bell size={14} color={colors.textMuted} />
              Push Notifications
            </div>
            <div className="toggle-switch-row">
              <div className="toggle-switch-content">
                <span className="toggle-switch-label">Enable Push Notifications</span>
                <span className="toggle-switch-desc">Get instant alerts for messages & announcements</span>
              </div>
              <div
                className={`toggle-switch ${pushEnabled ? 'on' : ''}`}
                onClick={pushLoading ? undefined : handleTogglePush}
                style={{ opacity: pushLoading ? 0.5 : 1, cursor: pushLoading ? 'wait' : 'pointer' }}
              />
            </div>
            {pushError && (
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${colors.border}` }}>
                <p style={{ margin: 0, fontSize: 12, color: colors.red, lineHeight: 1.5 }}>
                  {pushError}
                </p>
              </div>
            )}
            <div className="toggle-switch-row">
              <div className="toggle-switch-content">
                <span className="toggle-switch-label">Group Chat Notifications</span>
                <span className="toggle-switch-desc">Receive notifications for group messages</span>
              </div>
              <div
                className={`toggle-switch ${groupNotificationsEnabled ? 'on' : ''}`}
                onClick={groupNotificationsLoading ? undefined : handleToggleGroupNotifications}
                style={{ opacity: groupNotificationsLoading ? 0.5 : 1, cursor: groupNotificationsLoading ? 'wait' : 'pointer' }}
              />
            </div>
            {(profile.client_type === 'training' || profile.client_type === 'hybrid') && (
              <div className="toggle-switch-row">
                <div className="toggle-switch-content">
                  <span className="toggle-switch-label">Booking Reminders</span>
                  <span className="toggle-switch-desc">Remind me to book training sessions</span>
                </div>
                <div
                  className={`toggle-switch ${pushBookingReminders ? 'on' : ''}`}
                  onClick={() => setPushBookingReminders(!pushBookingReminders)}
                />
              </div>
            )}
          </div>
        )}

        {/* Account Info */}
        <div className="settings-card">
          <div className="settings-title">Account Info</div>
          <div className="info-row">
            <span className="info-label">Member since</span>
            <span className="info-value">{memberSince}</span>
          </div>
          {coachName && (
            <div className="info-row">
              <span className="info-label">Your Coach</span>
              <div className="coach-badge">
                <Icons.user size={14} color={colors.purple} />
                <span className="coach-badge-text">{coachName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="signout-btn"
        >
          <Icons.logOut size={18} color={colors.red} />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>

        {/* App Version */}
        <p className="app-version">Swear Strength v1.0.0</p>
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className="nav-item">
          <Icons.home size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Home</span>
        </Link>
        <Link href="/dashboard" className="nav-item">
          <Icons.calendar size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Calendar</span>
        </Link>
        <Link href="/workouts" className="nav-item">
          <Icons.dumbbell size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Plans</span>
        </Link>
        <div className="nav-item">
          <Icons.user size={22} color={colors.purple} />
          <span className="nav-label" style={{ color: colors.purple }}>Account</span>
        </div>
      </nav>
    </div>
  )
}
