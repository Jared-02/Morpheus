import type { ReactNode } from 'react'
import { Paper, Stack } from '@mantine/core'
import SectionHeader from './SectionHeader'

interface AppPanelProps {
  title?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  action?: ReactNode
  children: ReactNode
  padding?: string | number | Record<string, string | number>
}

export default function AppPanel({
  title,
  description,
  eyebrow,
  action,
  children,
  padding = 'lg',
}: AppPanelProps) {
  const hasHeader = title || description || eyebrow || action

  return (
    <Paper p={padding} radius="xl">
      <Stack gap="md">
        {hasHeader && (
          <SectionHeader
            title={title}
            description={description}
            eyebrow={eyebrow}
            action={action}
          />
        )}
        {children}
      </Stack>
    </Paper>
  )
}
