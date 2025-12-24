'use client'

import { forwardRef } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'outline'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: React.ReactNode
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-800 text-slate-300',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  outline: 'bg-transparent text-slate-400 border border-slate-700',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'sm', icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1 font-medium rounded-full
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {icon}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
