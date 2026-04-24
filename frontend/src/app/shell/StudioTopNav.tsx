import { ActionIcon, Burger, Button, Group, Text } from '@mantine/core'
import { IconMoonStars, IconSunHigh } from '@tabler/icons-react'
import { useUIStore } from '../../stores/useUIStore'
import { resolveThemeMode } from '../../theme/themeSystem'

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

export const STUDIO_DIRECTORY_ITEMS: StudioNavItem[] = [
  { label: '项目概述', to: (projectId) => `/project/${projectId}` },
  ...STUDIO_NAV_ITEMS,
]

export function isStudioNavActive(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`)
}

function StudioLogoMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="studio-topnav__logo-svg">
      <circle cx="12" cy="12" r="9" />
      <path d="M5 12a7 7 0 0 1 7-7" />
      <path d="M19 12a7 7 0 0 1-7 7" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

interface StudioTopNavProps {
  projectName?: string
  mobileNavOpened: boolean
  onToggleMobileNav: () => void
}

export default function StudioTopNav({
  projectName,
  mobileNavOpened,
  onToggleMobileNav,
}: StudioTopNavProps) {
  const themeMode = useUIStore((state) => state.themeMode)
  const setThemeMode = useUIStore((state) => state.setThemeMode)
  const resolvedTheme = resolveThemeMode(themeMode)
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
  const displayProjectName = projectName?.trim() || '赛博之城'

  return (
    <Group justify="space-between" h="100%" px={{ base: 'md', md: 'xl' }} wrap="nowrap" className="studio-topnav">
      <Group gap="sm" wrap="nowrap" className="studio-topnav__left">
        <Burger
          opened={mobileNavOpened}
          onClick={onToggleMobileNav}
          hiddenFrom="md"
          size="sm"
          aria-label={mobileNavOpened ? '收起目录' : '展开目录'}
        />

        <Group gap="md" wrap="nowrap" className="studio-topnav__brand-wrap">
          <span className="studio-topnav__logo" aria-hidden="true">
            <StudioLogoMark />
          </span>

          <Text fw={700} fz="lg" lh={1.1} ff="heading" className="studio-topnav__brand-title">
            Morpheus Studio
          </Text>

          <Text c="dimmed" visibleFrom="md" className="studio-topnav__brand-subtitle">
            AI 内容创作平台
          </Text>
        </Group>
      </Group>

      <Text fw={800} className="studio-topnav__project-name" visibleFrom="md" lineClamp={1}>
        {displayProjectName}
      </Text>

      <Group gap="xs" wrap="nowrap" visibleFrom="md" className="studio-topnav__actions">
        <Button
          size="sm"
          variant={resolvedTheme === 'light' ? 'filled' : 'subtle'}
          onClick={() => setThemeMode('light')}
          leftSection={<IconSunHigh size={14} stroke={1.8} />}
        >
          白天模式
        </Button>

        <Button
          size="sm"
          variant={resolvedTheme === 'dark' ? 'filled' : 'subtle'}
          onClick={() => setThemeMode('dark')}
          leftSection={<IconMoonStars size={14} stroke={1.8} />}
        >
          夜晚模式
        </Button>

        <button type="button" className="studio-topnav__avatar" aria-label="用户菜单">
          <span>👤</span>
        </button>
      </Group>

      <ActionIcon
        hiddenFrom="md"
        size="lg"
        onClick={() => setThemeMode(nextTheme)}
        aria-label={`切换到${nextTheme === 'dark' ? '夜晚' : '白天'}模式`}
      >
        {resolvedTheme === 'dark' ? <IconSunHigh size={18} stroke={1.8} /> : <IconMoonStars size={18} stroke={1.8} />}
      </ActionIcon>
    </Group>
  )
}
