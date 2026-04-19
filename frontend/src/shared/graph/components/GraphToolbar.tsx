import type { ReactNode } from 'react'
import { Group, SegmentedControl, Stack, Text } from '@mantine/core'

interface GraphToolbarOption {
  value: string
  label: string
}

interface GraphToolbarProps {
  layoutLabel: string
  layoutValue: string
  layoutOptions: GraphToolbarOption[]
  onLayoutChange: (value: string) => void
  scopeLabel: string
  scopeValue: string
  scopeOptions: GraphToolbarOption[]
  onScopeChange: (value: string) => void
  primaryActions?: ReactNode
  secondaryActions?: ReactNode
}

export default function GraphToolbar({
  layoutLabel,
  layoutValue,
  layoutOptions,
  onLayoutChange,
  scopeLabel,
  scopeValue,
  scopeOptions,
  onScopeChange,
  primaryActions,
  secondaryActions,
}: GraphToolbarProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" gap="md" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {layoutLabel}
            </Text>
            <SegmentedControl
              value={layoutValue}
              onChange={onLayoutChange}
              data={layoutOptions}
              size="sm"
            />
          </Stack>
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {scopeLabel}
            </Text>
            <SegmentedControl
              value={scopeValue}
              onChange={onScopeChange}
              data={scopeOptions}
              size="sm"
            />
          </Stack>
        </Group>
        {primaryActions && <Group gap="xs">{primaryActions}</Group>}
      </Group>
      {secondaryActions && <Group gap="xs" wrap="wrap">{secondaryActions}</Group>}
    </Stack>
  )
}
