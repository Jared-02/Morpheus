import type { ReactNode } from 'react'
import { Badge } from '@mantine/core'

type StatusBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const toneToColor: Record<StatusBadgeTone, string> = {
  neutral: 'gray',
  accent: 'morpheus',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
}

interface StatusBadgeProps {
  tone?: StatusBadgeTone
  children: ReactNode
}

export default function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return (
    <Badge variant="light" color={toneToColor[tone]}>
      {children}
    </Badge>
  )
}
