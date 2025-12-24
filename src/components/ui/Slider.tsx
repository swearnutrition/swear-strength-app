'use client'

import { forwardRef } from 'react'

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  showValue?: boolean
  min?: number
  max?: number
  step?: number
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className = '',
      label,
      showValue = true,
      min = 0,
      max = 100,
      step = 1,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const sliderId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const currentValue = Number(value) || min
    const percentage = ((currentValue - min) / (max - min)) * 100

    return (
      <div className={`space-y-2 ${className}`}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label htmlFor={sliderId} className="text-sm font-medium text-slate-300">
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm font-semibold text-white tabular-nums">
                {currentValue}
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="range"
            id={sliderId}
            min={min}
            max={max}
            step={step}
            value={value}
            className="
              w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-gradient-to-r
              [&::-webkit-slider-thumb]:from-purple-500
              [&::-webkit-slider-thumb]:to-indigo-500
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-purple-500/30
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:duration-150
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-thumb]:active:scale-95
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-gradient-to-r
              [&::-moz-range-thumb]:from-purple-500
              [&::-moz-range-thumb]:to-indigo-500
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer
            "
            style={{
              background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(99 102 241) ${percentage}%, rgb(30 41 59) ${percentage}%, rgb(30 41 59) 100%)`,
            }}
            {...props}
          />
        </div>
      </div>
    )
  }
)

Slider.displayName = 'Slider'
