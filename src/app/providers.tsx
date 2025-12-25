'use client'

import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/components/ui/Toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  )
}
