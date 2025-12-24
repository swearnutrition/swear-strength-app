'use client'

import { forwardRef } from 'react'

type CardVariant = 'default' | 'elevated' | 'gradient' | 'glass'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variants: Record<CardVariant, string> = {
  default: 'bg-slate-900/50 border border-slate-800',
  elevated: 'bg-slate-900/80 border border-slate-800 shadow-xl shadow-black/20',
  gradient: 'bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800',
  glass: 'bg-slate-900/30 backdrop-blur-xl border border-slate-800/50',
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-2xl
          ${variants[variant]}
          ${paddings[padding]}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', title, subtitle, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-start justify-between mb-4 ${className}`}
        {...props}
      >
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'
