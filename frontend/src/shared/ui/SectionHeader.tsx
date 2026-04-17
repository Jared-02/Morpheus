import type { ReactNode } from 'react'
import { Group, Stack, Text, Title } from '@mantine/core'

interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  action?: ReactNode
}

export default function SectionHeader({
  title,
  description,
  eyebrow,
  action,
}: SectionHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {eyebrow}
          </Text>
        )}
        <Title order={3}>{title}</Title>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {action}
    </Group>
  )
}
