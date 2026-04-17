import { useState, type CSSProperties } from 'react'
import type { NodeProps, NodeTypes } from 'reactflow'
import { Handle, Position } from 'reactflow'
import type { EntityNodeData } from './types'

export const ENTITY_STYLES: Record<string, { color: string; borderColor: string; textColor: string; shape: string; label: string }> = {
  character: { color: 'var(--graph-character-bg)', borderColor: 'var(--graph-character-border)', textColor: 'var(--graph-character-text)', shape: 'circle', label: '人物' },
  location: { color: 'var(--graph-location-bg)', borderColor: 'var(--graph-location-border)', textColor: 'var(--graph-location-text)', shape: 'square', label: '地点' },
  item: { color: 'var(--graph-item-bg)', borderColor: 'var(--graph-item-border)', textColor: 'var(--graph-item-text)', shape: 'diamond', label: '物品' },
}

const DEFAULT_STYLE = {
  color: 'var(--graph-default-bg)',
  borderColor: 'var(--graph-default-border)',
  textColor: 'var(--graph-default-text)',
  shape: 'square',
  label: '未知',
}

function EntityNodeComponent({ data }: NodeProps<EntityNodeData>) {
  const style = ENTITY_STYLES[data.entityType] ?? DEFAULT_STYLE
  const [hovered, setHovered] = useState(false)

  const shapeStyle: CSSProperties = {
    padding: style.shape === 'circle' ? '16px' : '14px 18px',
    borderRadius: style.shape === 'circle' ? '50%' : style.shape === 'diamond' ? '4px' : '8px',
    transform: style.shape === 'diamond' ? 'rotate(45deg)' : undefined,
    background: style.color,
    border: `2px solid ${style.borderColor}`,
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    fontWeight: 700,
    textAlign: 'center',
    minWidth: style.shape === 'circle' ? 72 : 80,
    minHeight: style.shape === 'circle' ? 72 : 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: data.dimmed ? 0.25 : 1,
    transition: 'opacity 200ms ease, box-shadow 200ms ease',
    boxShadow: data.highlighted ? `0 0 16px ${style.borderColor}` : 'none',
    position: 'relative',
    cursor: 'pointer',
  }

  const labelStyle: CSSProperties = style.shape === 'diamond' ? { transform: 'rotate(-45deg)' } : {}
  const attrEntries = Object.entries(data.attrs || {})

  return (
    <div className="graph-node-shell" style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <button
        type="button"
        style={{
          ...shapeStyle,
          appearance: 'none',
          width: '100%',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <span style={labelStyle}>{data.label}</span>
      </button>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {hovered && (
        <div
          role="tooltip"
          className="graph-node-tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 8,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--glass-border)',
            background: 'var(--graph-tooltip-bg)',
            backdropFilter: 'blur(20px)',
            boxShadow: 'var(--graph-tooltip-shadow)',
            zIndex: 100,
            minWidth: 180,
            maxWidth: 280,
            whiteSpace: 'normal',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
            {data.label}
            <span
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: '0.7rem',
                background: style.color,
                border: `1px solid ${style.borderColor}`,
              }}
            >
              {style.label}
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: attrEntries.length > 0 ? 6 : 0 }}>
            首次出现：第 {data.firstSeen} 章 · 最近：第 {data.lastSeen} 章
          </div>
          {attrEntries.length > 0 && (
            <div style={{ display: 'grid', gap: 3 }}>
              {attrEntries.map(([key, value]) => (
                <div key={key} style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{key}:</span> {String(value)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const nodeTypes: NodeTypes = { entity: EntityNodeComponent }
