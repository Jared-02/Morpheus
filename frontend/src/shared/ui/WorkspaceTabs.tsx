import type { ReactNode } from 'react'
import { Tabs } from '@mantine/core'

export interface WorkspaceTabItem {
  value: string
  label: ReactNode
  panel: ReactNode
}

interface WorkspaceTabsProps {
  value: string
  onChange: (value: string | null) => void
  tabs: WorkspaceTabItem[]
}

export default function WorkspaceTabs({ value, onChange, tabs }: WorkspaceTabsProps) {
  return (
    <Tabs value={value} onChange={onChange} keepMounted={false}>
      <Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {tabs.map((tab) => (
        <Tabs.Panel key={tab.value} value={tab.value} pt="md">
          {tab.panel}
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}
