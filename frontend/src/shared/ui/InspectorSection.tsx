import type { ReactNode } from 'react'
import { Paper, Stack, Text } from '@mantine/core'

interface InspectorSectionProps {
  label: ReactNode
  children: ReactNode
}

export default function InspectorSection({ label, children }: InspectorSectionProps) {
  return (
    <Paper p="md" radius="lg">
      <Stack gap={6}>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
          {label}
        </Text>
        <Text size="sm">{children}</Text>
      </Stack>
    </Paper>
  )
}
