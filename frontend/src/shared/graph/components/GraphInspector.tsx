import type { ReactNode } from 'react'
import { Stack, Text } from '@mantine/core'
import AppPanel from '../../ui/AppPanel'
import InspectorSection from '../../ui/InspectorSection'

interface GraphInspectorSectionItem {
  label: ReactNode
  value: ReactNode
}

interface GraphInspectorProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  sections: GraphInspectorSectionItem[]
  actions?: ReactNode
}

export default function GraphInspector({
  eyebrow,
  title,
  description,
  sections,
  actions,
}: GraphInspectorProps) {
  return (
    <AppPanel eyebrow={eyebrow} title={title} description={description} padding="md">
      <Stack gap="md">
        {sections.length === 0 ? (
          <Text size="sm" c="dimmed">
            当前没有可展示的建模信息。
          </Text>
        ) : (
          sections.map((section) => (
            <InspectorSection key={String(section.label)} label={section.label}>
              {section.value}
            </InspectorSection>
          ))
        )}
        {actions}
      </Stack>
    </AppPanel>
  )
}
