import { useEffect } from 'react'
import { AppShell, Button, Drawer, ScrollArea, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { useProjectStore } from '../../stores/useProjectStore'
import StudioTopNav, { STUDIO_NAV_ITEMS, isStudioNavActive } from './StudioTopNav'

export default function StudioAppShell() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const [mobileNavOpened, { toggle: toggleMobileNav, close: closeMobileNav }] = useDisclosure(false)

  useEffect(() => {
    if (projectId) {
      void fetchProject(projectId)
    }
  }, [projectId, fetchProject])

  if (!projectId) {
    return <Outlet />
  }

  return (
    <AppShell header={{ height: 76 }} padding={0} className="studio-shell">
      <AppShell.Header>
        <StudioTopNav
          projectId={projectId}
          mobileNavOpened={mobileNavOpened}
          onToggleMobileNav={toggleMobileNav}
        />
      </AppShell.Header>

      <AppShell.Main>
        <div className="studio-shell__main">
          <Outlet />
        </div>
      </AppShell.Main>

      <Drawer
        opened={mobileNavOpened}
        onClose={closeMobileNav}
        title="工作台导航"
        padding="md"
        size="88%"
        hiddenFrom="md"
      >
        <ScrollArea.Autosize mah="70vh" type="scroll">
          <Stack gap="xs">
            <Button component={Link} to="/" variant={location.pathname === '/' ? 'filled' : 'subtle'} justify="flex-start" onClick={closeMobileNav}>
              我的项目
            </Button>
            <Button
              component={Link}
              to={`/project/${projectId}`}
              variant={location.pathname === `/project/${projectId}` ? 'filled' : 'subtle'}
              justify="flex-start"
              onClick={closeMobileNav}
            >
              项目详情
            </Button>
            {STUDIO_NAV_ITEMS.map((item) => {
              const target = item.to(projectId)
              const active = isStudioNavActive(location.pathname, target)
              return (
                <Button
                  key={item.label}
                  component={Link}
                  to={target}
                  variant={active ? 'filled' : 'subtle'}
                  justify="flex-start"
                  onClick={closeMobileNav}
                >
                  {item.label}
                </Button>
              )
            })}
            <Text size="sm" c="dimmed" mt="sm">
              旧章节链接会自动兼容跳转到新的文本创作工作台。
            </Text>
          </Stack>
        </ScrollArea.Autosize>
      </Drawer>
    </AppShell>
  )
}
