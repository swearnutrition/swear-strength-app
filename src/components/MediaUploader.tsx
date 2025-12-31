'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import imageCompression from 'browser-image-compression'

interface MediaUploaderProps {
  conversationId: string
  onUploadComplete: (url: string, type: 'image' | 'video') => void
  onError: (error: string) => void
}

export function MediaUploader({ conversationId, onUploadComplete, onError }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    try {
      let processedFile = file
      let contentType: 'image' | 'video' = 'image'

      // Check file type
      if (file.type.startsWith('video/')) {
        contentType = 'video'
        // Check video duration
        const duration = await getVideoDuration(file)
        if (duration > 30) {
          throw new Error('Video must be 30 seconds or less')
        }
        // For now, upload video as-is (ffmpeg.wasm compression can be added later)
        processedFile = file
      } else if (file.type.startsWith('image/')) {
        contentType = 'image'
        // Convert HEIC/DNG to JPEG and compress
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default
          const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
          processedFile = new File(
            [converted as Blob],
            file.name.replace(/\.heic$/i, '.jpg'),
            { type: 'image/jpeg' }
          )
        }

        // Compress image
        setProgress(20)
        processedFile = await imageCompression(processedFile, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          onProgress: (p) => setProgress(20 + p * 0.6),
        })
      } else {
        throw new Error('Unsupported file type')
      }

      setProgress(80)

      // Upload to Supabase Storage
      const fileExt = processedFile.name.split('.').pop() || 'jpg'
      const fileName = `${conversationId}/${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(fileName)

      setProgress(100)
      onUploadComplete(publicUrl, contentType)
    } catch (err) {
      console.error('Upload error:', err)
      onError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      video.onerror = () => reject(new Error('Could not read video'))
      video.src = URL.createObjectURL(file)
    })
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.heic"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
        title="Upload image or video"
      >
        {uploading ? (
          <div className="relative w-5 h-5">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Progress indicator */}
      {uploading && progress > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4">
          <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 24 24">
            <circle
              className="text-slate-700"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="4"
              stroke="currentColor"
            />
            <circle
              className="text-purple-500"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="4"
              stroke="currentColor"
              strokeDasharray={`${progress * 0.628} 62.8`}
            />
          </svg>
        </div>
      )}
    </div>
  )
}
