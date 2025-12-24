'use client'

import { forwardRef } from 'react'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  src?: string | null
  size?: AvatarSize
}

const sizes: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', name, src, size = 'md', ...props }, ref) => {
    const initials = getInitials(name)

    return (
      <div
        ref={ref}
        className={`
          relative rounded-full overflow-hidden
          bg-gradient-to-br from-purple-500 to-indigo-600
          flex items-center justify-center
          text-white font-semibold
          shadow-lg shadow-purple-500/20
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
