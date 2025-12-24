'use client'

import { forwardRef } from 'react'

type ProgressRingSize = 'sm' | 'md' | 'lg' | 'xl'

interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number // 0-100
  size?: ProgressRingSize
  strokeWidth?: number
  showValue?: boolean
  color?: 'purple' | 'emerald' | 'amber' | 'blue'
}

const sizes: Record<ProgressRingSize, number> = {
  sm: 40,
  md: 56,
  lg: 72,
  xl: 96,
}

const colors = {
  purple: 'stroke-purple-500',
  emerald: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  blue: 'stroke-blue-500',
}

export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      className = '',
      value,
      size = 'md',
      strokeWidth = 4,
      showValue = true,
      color = 'purple',
      ...props
    },
    ref
  ) => {
    const sizeValue = sizes[size]
    const radius = (sizeValue - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

    return (
      <div
        ref={ref}
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width: sizeValue, height: sizeValue }}
        {...props}
      >
        <svg
          className="transform -rotate-90"
          width={sizeValue}
          height={sizeValue}
        >
          {/* Background circle */}
          <circle
            cx={sizeValue / 2}
            cy={sizeValue / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="stroke-slate-800 fill-none"
          />
          {/* Progress circle */}
          <circle
            cx={sizeValue / 2}
            cy={sizeValue / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={`fill-none transition-all duration-500 ease-out ${colors[color]}`}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        {showValue && (
          <span className="absolute text-white font-semibold" style={{ fontSize: sizeValue / 4 }}>
            {Math.round(value)}%
          </span>
        )}
      </div>
    )
  }
)

ProgressRing.displayName = 'ProgressRing'
