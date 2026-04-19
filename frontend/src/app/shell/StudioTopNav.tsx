import { ActionIcon, Badge, Burger, Button, Group, Stack, Text } from '@mantine/core'
import { IconArrowLeft, IconMoonStars, IconSunHigh } from '@tabler/icons-react'
import { Link, useLocation } from 'react-router-dom'
import { resolveThemeMode } from '../../theme/themeSystem'
import { useUIStore } from '../../stores/useUIStore'

export interface StudioNavItem {
  label: string
  to: (projectId: string) => string
}

export const STUDIO_NAV_ITEMS: StudioNavItem[] = [
  { label: '叙事建模', to: (projectId) => `/project/${projectId}/model` },
  { label: '文本创作', to: (projectId) => `/project/${projectId}/write` },
  { label: '媒体创作', to: (projectId) => `/project/${projectId}/media` },
  { label: '智策回溯', to: (projectId) => `/project/${projectId}/replay` },
  { label: '智能体', to: (projectId) => `/project/${projectId}/agents` },
]

export function isStudioNavActive(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`)
}

interface StudioTopNavProps {
  projectId: string
  projectName?: string
  mobileNavOpened: boolean
  onToggleMobileNav: () => void
}

export default function StudioTopNav({
  projectId,
  projectName,
  mobileNavOpened,
  onToggleMobileNav,
}: StudioTopNavProps) {
  const location = useLocation()
  const themeMode = useUIStore((state) => state.themeMode)
  const setThemeMode = useUIStore((state) => state.setThemeMode)
  const resolvedTheme = resolveThemeMode(themeMode)
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
  const activeNavItem = STUDIO_NAV_ITEMS.find((item) => isStudioNavActive(location.pathname, item.to(projectId)))
  const activeLabel = activeNavItem?.label || '工作台'

  return (
    <Group justify="space-between" h="100%" px={{ base: 'md', md: 'xl' }} wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <Burger
          opened={mobileNavOpened}
          onClick={onToggleMobileNav}
          hiddenFrom="md"
          size="sm"
          aria-label={mobileNavOpened ? '收起工作台导航' : '打开工作台导航'}
        />
        <ActionIcon
          component={Link}
          to={`/project/${projectId}`}
          size="lg"
          aria-label="返回项目概览"
        >
          <IconArrowLeft size={18} stroke={1.8} />
        </ActionIcon>
          <Stack gap={2}>
            <Group gap="xs" wrap="nowrap">
              <Text fw={700} fz="lg" lh={1.1} ff="heading">
                Morpheus Studio
              </Text>
              <Badge variant="light">Phase 4</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {projectName ? `${projectName} · ${activeLabel}工作台已接入新壳层` : `${activeLabel}工作台已接入新壳层`}
            </Text>
          </Stack>
        </Group>

      <Group gap="xs" visibleFrom="md" wrap="nowrap">
        {STUDIO_NAV_ITEMS.map((item) => {
          const target = item.to(projectId)
          const active = isStudioNavActive(location.pathname, target)
          return (
            <Button
              key={item.label}
              component={Link}
              to={target}
              variant={active ? 'filled' : 'subtle'}
            >
              {item.label}
            </Button>
          )
        })}
      </Group>

      <ActionIcon
        size="lg"
        onClick={() => setThemeMode(nextTheme)}
        aria-label={`切换到${nextTheme === 'dark' ? '深色' : '浅色'}模式`}
      >
        {resolvedTheme === 'dark' ? <IconSunHigh size={18} stroke={1.8} /> : <IconMoonStars size={18} stroke={1.8} />}
      </ActionIcon>
    </Group>
  )
}
