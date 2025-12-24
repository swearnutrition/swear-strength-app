'use client'

import { forwardRef } from 'react'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, description, id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <label
        htmlFor={checkboxId}
        className={`flex items-start gap-3 cursor-pointer group ${className}`}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className="peer sr-only"
            {...props}
          />
          <div
            className={`
              w-5 h-5 rounded-md border-2 border-slate-600
              bg-slate-800/50
              transition-all duration-200
              peer-checked:bg-purple-600 peer-checked:border-purple-600
              peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500/50
              group-hover:border-slate-500 peer-checked:group-hover:border-purple-500
            `}
          />
          <svg
            className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        {(label || description) && (
          <div className="flex-1">
            {label && (
              <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                {label}
              </span>
            )}
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'
