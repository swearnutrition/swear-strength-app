'use client'

import { useTheme } from '@/lib/theme'

export interface ThemeColors {
  // Backgrounds
  bg: string
  bgGradient: string
  bgCard: string
  bgCardSolid: string
  bgCardHover: string
  bgGlass: string
  bgTertiary: string
  bgInput: string

  // Text
  text: string
  textSecondary: string
  textMuted: string

  // Borders
  border: string
  borderLight: string
  borderGlow: string

  // Brand - Purple
  purple: string
  purpleLight: string
  purpleDark: string
  purpleGlow: string
  purpleGradient: string

  // Status - Green
  green: string
  greenLight: string
  greenGradient: string

  // Status - Amber
  amber: string
  amberLight: string
  amberGradient: string

  // Status - Red
  red: string

  // Status - Blue
  blue: string

  // Card gradient
  cardGradient: string

  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
  shadowPurple: string
  shadowGreen: string
  shadowAmber: string

  // Legacy aliases (for backwards compatibility)
  textPrimary: string
  card: string
  cardLight: string
  cardHover: string
}

const darkColors: ThemeColors = {
  // Backgrounds - rich dark with purple undertone
  bg: '#0c0a1d',
  bgGradient: 'linear-gradient(180deg, #0c0a1d 0%, #1a1333 50%, #0f0d1a 100%)',
  bgCard: 'rgba(26, 22, 48, 0.6)',
  bgCardSolid: '#1a1630',
  bgCardHover: 'rgba(36, 30, 66, 0.8)',
  bgGlass: 'rgba(255, 255, 255, 0.03)',
  bgTertiary: 'rgba(139, 92, 246, 0.08)',
  bgInput: 'rgba(255, 255, 255, 0.05)',

  // Text
  text: '#ffffff',
  textSecondary: '#a5a3b8',
  textMuted: '#6b6880',

  // Borders
  border: 'rgba(139, 92, 246, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  borderGlow: 'rgba(139, 92, 246, 0.3)',

  // Brand - Purple
  purple: '#a78bfa',
  purpleLight: 'rgba(167, 139, 250, 0.15)',
  purpleDark: '#8b5cf6',
  purpleGlow: 'rgba(139, 92, 246, 0.4)',
  purpleGradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)',

  // Status - Green
  green: '#34d399',
  greenLight: 'rgba(52, 211, 153, 0.15)',
  greenGradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',

  // Status - Amber
  amber: '#fbbf24',
  amberLight: 'rgba(251, 191, 36, 0.15)',
  amberGradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',

  // Status - Red
  red: '#ef4444',

  // Status - Blue
  blue: '#60a5fa',

  // Card gradient
  cardGradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',

  // Shadows (colored, not gray)
  shadowSm: '0 2px 8px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 8px 24px rgba(0, 0, 0, 0.4)',
  shadowLg: '0 16px 48px rgba(0, 0, 0, 0.5)',
  shadowPurple: '0 8px 32px rgba(139, 92, 246, 0.3)',
  shadowGreen: '0 4px 16px rgba(52, 211, 153, 0.3)',
  shadowAmber: '0 4px 16px rgba(251, 191, 36, 0.3)',

  // Legacy aliases
  textPrimary: '#ffffff',
  card: '#1a1630',
  cardLight: 'rgba(26, 22, 48, 0.6)',
  cardHover: 'rgba(36, 30, 66, 0.8)',
}

const lightColors: ThemeColors = {
  // Backgrounds - warm off-white with subtle purple tint
  bg: '#faf8ff',
  bgGradient: 'linear-gradient(180deg, #faf8ff 0%, #f5f3ff 50%, #ffffff 100%)',
  bgCard: 'rgba(255, 255, 255, 0.9)',
  bgCardSolid: '#ffffff',
  bgCardHover: '#ffffff',
  bgGlass: 'rgba(255, 255, 255, 0.7)',
  bgTertiary: '#f5f3ff',
  bgInput: '#f8fafc',

  // Text
  text: '#1e1b4b',
  textSecondary: '#4c4977',
  textMuted: '#8b85ad',

  // Borders
  border: 'rgba(139, 92, 246, 0.12)',
  borderLight: '#e9e5ff',
  borderGlow: 'rgba(139, 92, 246, 0.25)',

  // Brand - Purple
  purple: '#7c3aed',
  purpleLight: 'rgba(124, 58, 237, 0.08)',
  purpleDark: '#6d28d9',
  purpleGlow: 'rgba(124, 58, 237, 0.2)',
  purpleGradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',

  // Status - Green
  green: '#059669',
  greenLight: 'rgba(5, 150, 105, 0.1)',
  greenGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',

  // Status - Amber
  amber: '#d97706',
  amberLight: 'rgba(217, 119, 6, 0.1)',
  amberGradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',

  // Status - Red
  red: '#ef4444',

  // Status - Blue
  blue: '#2563eb',

  // Card gradient
  cardGradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04) 0%, rgba(59, 130, 246, 0.02) 100%)',

  // Shadows (purple-tinted, not gray)
  shadowSm: '0 2px 8px rgba(124, 58, 237, 0.06)',
  shadowMd: '0 8px 24px rgba(124, 58, 237, 0.08)',
  shadowLg: '0 16px 48px rgba(124, 58, 237, 0.12)',
  shadowPurple: '0 8px 32px rgba(124, 58, 237, 0.15)',
  shadowGreen: '0 4px 16px rgba(5, 150, 105, 0.2)',
  shadowAmber: '0 4px 16px rgba(217, 119, 6, 0.2)',

  // Legacy aliases
  textPrimary: '#1e1b4b',
  card: '#ffffff',
  cardLight: 'rgba(255, 255, 255, 0.9)',
  cardHover: '#ffffff',
}

export function useColors(): ThemeColors {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'light' ? lightColors : darkColors
}

export function getColors(theme: 'dark' | 'light'): ThemeColors {
  return theme === 'light' ? lightColors : darkColors
}
