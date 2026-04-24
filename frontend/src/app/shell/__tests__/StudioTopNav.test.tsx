import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import StudioTopNav from '../StudioTopNav'

function renderNav(projectName?: string) {
  return render(
    <MantineProvider>
      <div style={{ height: 76 }}>
        <StudioTopNav
          projectName={projectName}
          mobileNavOpened={false}
          onToggleMobileNav={() => undefined}
        />
      </div>
    </MantineProvider>,
  )
}

describe('StudioTopNav', () => {
  it('renders brand and provided project name', () => {
    renderNav('测试项目A')

    expect(screen.getByText('Morpheus Studio')).toBeInTheDocument()
    expect(screen.getByText('测试项目A')).toBeInTheDocument()
  })

  it('falls back to default project name when missing', () => {
    renderNav()

    expect(screen.getByText('赛博之城')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '白天模式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '夜晚模式' })).toBeInTheDocument()
  })
})
