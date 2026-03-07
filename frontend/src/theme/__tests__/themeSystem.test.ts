import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    MONET_THEME_PALETTES,
    applyResolvedTheme,
    getMonetPaletteById,
    resolveThemeMode,
} from '../themeSystem'

describe('themeSystem', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme')
        document.documentElement.removeAttribute('data-palette')
        document.documentElement.style.cssText = ''
    })

    it('defines four curated Monet-inspired palettes', () => {
        expect(MONET_THEME_PALETTES).toHaveLength(4)
        expect(MONET_THEME_PALETTES.map((item) => item.id)).toEqual([
            'water-lilies-dawn',
            'sunrise-on-the-seine',
            'parliament-twilight',
            'garden-mist',
        ])
    })

    it('finds a palette by id', () => {
        const palette = getMonetPaletteById('sunrise-on-the-seine')
        expect(palette.id).toBe('sunrise-on-the-seine')
        expect(palette.label).toContain('日出')
    })

    it('falls back to the default Monet palette for unknown ids', () => {
        expect(getMonetPaletteById('unknown-palette').id).toBe('water-lilies-dawn')
    })

    it('resolves explicit light and dark modes directly', () => {
        expect(resolveThemeMode('light')).toBe('light')
        expect(resolveThemeMode('dark')).toBe('dark')
    })

    it('resolves system mode using prefers-color-scheme', () => {
        const matchMedia = vi.fn().mockReturnValue({ matches: true })
        vi.stubGlobal('matchMedia', matchMedia)

        expect(resolveThemeMode('system')).toBe('dark')
        expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    })

    it('applies theme attributes and Monet palette variables to the root element', () => {
        applyResolvedTheme(document.documentElement, 'dark', 'parliament-twilight')

        expect(document.documentElement.dataset.theme).toBe('dark')
        expect(document.documentElement.dataset.palette).toBe('parliament-twilight')
        expect(document.documentElement.style.getPropertyValue('--palette-bg-0')).not.toBe('')
        expect(document.documentElement.style.getPropertyValue('--palette-accent')).not.toBe('')
        expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('dark')
    })
})
