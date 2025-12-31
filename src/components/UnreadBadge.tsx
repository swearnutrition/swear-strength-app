'use client'

interface UnreadBadgeProps {
  count: number
  size?: 'sm' | 'md'
}

export function UnreadBadge({ count, size = 'md' }: UnreadBadgeProps) {
  if (count <= 0) return null

  const sizeClasses = size === 'sm'
    ? 'w-4 h-4 text-[10px]'
    : 'w-5 h-5 text-xs'

  return (
    <span
      className={`
        ${sizeClasses}
        flex items-center justify-center
        bg-purple-500 text-white font-bold rounded-full
        animate-in zoom-in duration-200
      `}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
