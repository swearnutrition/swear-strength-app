'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, setIsNavigating] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Reset when navigation completes
    setIsNavigating(false)
    setProgress(100)

    const timeout = setTimeout(() => {
      setProgress(0)
    }, 200)

    return () => clearTimeout(timeout)
  }, [pathname, searchParams])

  useEffect(() => {
    let progressInterval: NodeJS.Timeout

    if (isNavigating) {
      setProgress(0)
      // Quickly move to 30%, then slow down
      const startTime = Date.now()

      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        // Quick jump to 30%, then slow asymptotic approach to 90%
        if (elapsed < 100) {
          setProgress(30)
        } else {
          setProgress(prev => {
            if (prev >= 90) return prev
            return prev + (90 - prev) * 0.1
          })
        }
      }, 50)
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [isNavigating])

  // Listen for navigation start via click events on links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link) {
        const href = link.getAttribute('href')
        // Only trigger for internal navigation
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          // Check if it's not the current page
          const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
          if (href !== currentPath && href !== pathname) {
            setIsNavigating(true)
          }
        }
      }
    }

    // Also handle programmatic navigation via History API
    const handleBeforeUnload = () => {
      setIsNavigating(true)
    }

    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [pathname, searchParams])

  if (progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 10px rgba(168, 85, 247, 0.5), 0 0 5px rgba(168, 85, 247, 0.3)'
        }}
      />
    </div>
  )
}
