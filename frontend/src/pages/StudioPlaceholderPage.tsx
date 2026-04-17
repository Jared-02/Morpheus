import type { ReactNode } from 'react'
import { Button, Card, Group, List, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link, useParams } from 'react-router-dom'
import WorkspaceFrame from '../app/shell/WorkspaceFrame'
import AppPanel from '../shared/ui/AppPanel'
import InspectorSection from '../shared/ui/InspectorSection'
import StatusBadge from '../shared/ui/StatusBadge'

interface PlaceholderItem {
  title: string
  detail: string
}

interface PlaceholderFact {
  label: string
  value: string
}

interface StudioPlaceholderPageProps {
  title: string
  description: string
  phaseLabel: string
  summary: string
  milestone: string
  fallbackRoute: (projectId: string) => string
  fallbackLabel: string
  railTitle: string
  railItems: PlaceholderItem[]
  inspectorTitle: string
  inspectorItems: PlaceholderFact[]
  nextSteps: string[]
  highlight?: ReactNode
}

export default function StudioPlaceholderPage({
  title,
  description,
  phaseLabel,
  summary,
  milestone,
  fallbackRoute,
  fallbackLabel,
  railTitle,
  railItems,
  inspectorTitle,
  inspectorItems,
  nextSteps,
  highlight,
}: StudioPlaceholderPageProps) {
  const { projectId } = useParams<{ projectId: string }>()

  const rail = (
    <Stack gap="sm">
      {railItems.map((item) => (
        <Card key={item.title} padding="md">
          <Text fw={600} size="sm">
            {item.title}
          </Text>
          <Text size="sm" c="dimmed" mt={6}>
            {item.detail}
          </Text>
        </Card>
      ))}
    </Stack>
  )

  const inspector = (
    <Stack gap="sm">
      {inspectorItems.map((item) => (
        <InspectorSection key={item.label} label={item.label}>
          {item.value}
        </InspectorSection>
      ))}
    </Stack>
  )

  return (
    <WorkspaceFrame
      title={title}
      description={description}
      railTitle={railTitle}
      rail={rail}
      inspectorTitle={inspectorTitle}
      inspector={inspector}
      toolbar={
        <Group gap="xs">
          <StatusBadge tone="accent">{phaseLabel}</StatusBadge>
          {projectId && (
            <Button component={Link} to={fallbackRoute(projectId)} variant="subtle">
              {fallbackLabel}
            </Button>
          )}
        </Group>
      }
    >
      <Stack gap="md">
        <AppPanel padding={{ base: 'lg', md: 'xl' }}>
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon size={42} radius="xl" variant="light" color="morpheus">
                <span>01</span>
              </ThemeIcon>
              <div>
                <Text size="sm" fw={600} c="dimmed">
                  第 1 周已落地
                </Text>
                <Title order={2}>{summary}</Title>
              </div>
            </Group>
            <Text size="sm" c="dimmed" maw={760}>
              当前页面用于承接新顶栏、多工作区和移动端 Drawer 骨架，后续业务内容会在 {milestone} 正式迁入，避免在换壳阶段直接改动现有核心页面。
            </Text>
            {highlight}
          </Stack>
        </AppPanel>

        <AppPanel title="后续迁移重点" padding="lg">
          <List spacing="sm" mt="sm" center>
            {nextSteps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List>
        </AppPanel>
      </Stack>
    </WorkspaceFrame>
  )
}
