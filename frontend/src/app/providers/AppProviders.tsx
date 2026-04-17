import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { useUIStore } from '../../stores/useUIStore'
import { mantineTheme } from '../../theme/mantineTheme'
import { applyResolvedTheme, resolveThemeMode } from '../../theme/themeSystem'

interface AppProvidersProps {
  children: ReactNode
}

export default function AppProviders({ children }: AppProvidersProps) {
  const themeMode = useUIStore((state) => state.themeMode)
  const themePaletteId = useUIStore((state) => state.themePaletteId)
  const resolvedTheme = resolveThemeMode(themeMode)

  useEffect(() => {
    applyResolvedTheme(document.documentElement, resolvedTheme, themePaletteId)
  }, [resolvedTheme, themePaletteId])

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={resolvedTheme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="top-right" zIndex={3000} />
        {children}
      </ModalsProvider>
    </MantineProvider>
  )
}
