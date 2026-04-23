import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import StudioTopNav from '../StudioTopNav'

function renderNav(initialPath = '/project/p1/model') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <div style={{ height: 76 }}>
          <StudioTopNav
            projectId="p1"
            mobileNavOpened={false}
            onToggleMobileNav={() => undefined}
          />
        </div>
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('StudioTopNav', () => {
  it('renders project entry buttons with correct targets', () => {
    renderNav()

    expect(screen.getByRole('link', { name: '我的项目' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '项目详情' })).toHaveAttribute('href', '/project/p1')
  })

  it('keeps project detail button active on detail page', () => {
    renderNav('/project/p1')

    const detailLink = screen.getByRole('link', { name: '项目详情' })
    expect(detailLink.getAttribute('data-variant')).toBe('filled')
  })
})
