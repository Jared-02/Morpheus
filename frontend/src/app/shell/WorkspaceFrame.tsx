import type { ReactNode } from 'react'
import { Box, Button, Drawer, Group, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'

interface WorkspaceFrameProps {
  title: string
  description?: string
  toolbar?: ReactNode
  railTitle?: string
  rail?: ReactNode
  inspectorTitle?: string
  inspector?: ReactNode
  children: ReactNode
}

export default function WorkspaceFrame({
  title,
  description,
  toolbar,
  railTitle,
  rail,
  inspectorTitle,
  inspector,
  children,
}: WorkspaceFrameProps) {
  const isMobile = useMediaQuery('(max-width: 64em)')
  const [railOpened, railControls] = useDisclosure(false)
  const [inspectorOpened, inspectorControls] = useDisclosure(false)

  const columnTemplate = rail && inspector
    ? '280px minmax(0, 1fr) 320px'
    : rail
      ? '280px minmax(0, 1fr)'
      : inspector
        ? 'minmax(0, 1fr) 320px'
        : 'minmax(0, 1fr)'

  return (
    <div className="workspace-frame">
      <Group justify="space-between" align="flex-start" gap="md" className="workspace-frame__head">
        <Stack gap={4}>
          <Title order={1} className="workspace-frame__title">
            {title}
          </Title>
          {description && (
            <Text size="sm" c="dimmed" maw={760}>
              {description}
            </Text>
          )}
        </Stack>
        {toolbar && <Group gap="xs">{toolbar}</Group>}
      </Group>

      {isMobile && (rail || inspector) && (
        <Group gap="xs" className="workspace-frame__mobile-actions">
          {rail && (
            <Button variant="subtle" onClick={railControls.open}>
              打开{railTitle || '左侧面板'}
            </Button>
          )}
          {inspector && (
            <Button variant="subtle" onClick={inspectorControls.open}>
              打开{inspectorTitle || 'Inspector'}
            </Button>
          )}
        </Group>
      )}

      <div className="workspace-frame__body" style={{ gridTemplateColumns: isMobile ? '1fr' : columnTemplate }}>
        {!isMobile && rail && (
          <Paper p="md" className="workspace-frame__panel workspace-frame__panel--rail">
            {railTitle && (
              <Text fw={600} size="sm" mb="sm">
                {railTitle}
              </Text>
            )}
            <ScrollArea.Autosize mah="calc(100vh - 240px)" type="scroll">
              {rail}
            </ScrollArea.Autosize>
          </Paper>
        )}

        <Box className="workspace-frame__main">{children}</Box>

        {!isMobile && inspector && (
          <Paper p="md" className="workspace-frame__panel workspace-frame__panel--inspector">
            {inspectorTitle && (
              <Text fw={600} size="sm" mb="sm">
                {inspectorTitle}
              </Text>
            )}
            <ScrollArea.Autosize mah="calc(100vh - 240px)" type="scroll">
              {inspector}
            </ScrollArea.Autosize>
          </Paper>
        )}
      </div>

      <Drawer
        opened={railOpened}
        onClose={railControls.close}
        title={railTitle || '左侧面板'}
        position="left"
        size="88%"
      >
        {rail}
      </Drawer>

      <Drawer
        opened={inspectorOpened}
        onClose={inspectorControls.close}
        title={inspectorTitle || 'Inspector'}
        position="right"
        size="88%"
      >
        {inspector}
      </Drawer>
    </div>
  )
}
