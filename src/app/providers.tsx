'use client'

import { Suspense } from 'react'
import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/components/ui/Toast'
import { NavigationProgress } from '@/components/NavigationProgress'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark">
      <ToastProvider>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </ToastProvider>
    </ThemeProvider>
  )
}
