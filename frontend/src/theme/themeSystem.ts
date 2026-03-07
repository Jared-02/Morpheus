export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const FIXED_THEME_PALETTES: Record<ResolvedTheme, string> = {
    light: 'water-lilies-dawn',
    dark: 'parliament-twilight',
}

export interface MonetThemePalette {
    id: string
    label: string
    description: string
    colors: {
        bg0: string
        bg1: string
        bg2: string
        glowA: string
        glowB: string
        accent: string
        accentHover: string
        accentSoft: string
        accentBorder: string
        buttonText: string
    }
}

export const MONET_THEME_PALETTES: MonetThemePalette[] = [
    {
        id: 'water-lilies-dawn',
        label: '睡莲晨光',
        description: '柔雾蓝绿与晨光金的平衡，适合作为默认莫奈主题。',
        colors: {
            bg0: '#f3f7fb',
            bg1: '#e9f3f1',
            bg2: '#fff9f0',
            glowA: 'rgba(130, 181, 169, 0.24)',
            glowB: 'rgba(244, 197, 129, 0.18)',
            accent: '#6ba89c',
            accentHover: '#4d8f83',
            accentSoft: 'rgba(107, 168, 156, 0.16)',
            accentBorder: 'rgba(107, 168, 156, 0.30)',
            buttonText: '#fdfdfc',
        },
    },
    {
        id: 'sunrise-on-the-seine',
        label: '塞纳日出',
        description: '偏暖的金橙与水蓝对比，按钮视觉更活跃。',
        colors: {
            bg0: '#f8f4ef',
            bg1: '#eef4fa',
            bg2: '#fff6e7',
            glowA: 'rgba(247, 182, 92, 0.22)',
            glowB: 'rgba(100, 154, 202, 0.18)',
            accent: '#d88b4c',
            accentHover: '#bf7135',
            accentSoft: 'rgba(216, 139, 76, 0.18)',
            accentBorder: 'rgba(216, 139, 76, 0.32)',
            buttonText: '#fffdf8',
        },
    },
    {
        id: 'parliament-twilight',
        label: '议会暮色',
        description: '偏紫蓝的暮色层次，适合深色模式下的戏剧化氛围。',
        colors: {
            bg0: '#151826',
            bg1: '#1b2340',
            bg2: '#241f35',
            glowA: 'rgba(118, 141, 220, 0.28)',
            glowB: 'rgba(201, 146, 184, 0.20)',
            accent: '#8a78c8',
            accentHover: '#7361b7',
            accentSoft: 'rgba(138, 120, 200, 0.22)',
            accentBorder: 'rgba(138, 120, 200, 0.38)',
            buttonText: '#fbfaff',
        },
    },
    {
        id: 'garden-mist',
        label: '花园薄雾',
        description: '鼠尾草绿与淡玫瑰的静谧组合，适合长时间阅读。',
        colors: {
            bg0: '#f2f4ef',
            bg1: '#e8efe7',
            bg2: '#faf5f1',
            glowA: 'rgba(137, 162, 136, 0.22)',
            glowB: 'rgba(214, 173, 161, 0.16)',
            accent: '#7d9483',
            accentHover: '#667c6c',
            accentSoft: 'rgba(125, 148, 131, 0.16)',
            accentBorder: 'rgba(125, 148, 131, 0.28)',
            buttonText: '#fcfcfa',
        },
    },
]

const DEFAULT_PALETTE = MONET_THEME_PALETTES[0]

export function getMonetPaletteById(id: string): MonetThemePalette {
    return MONET_THEME_PALETTES.find((palette) => palette.id === id) ?? DEFAULT_PALETTE
}

export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
    if (mode !== 'system') return mode
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
}

export function getFixedPaletteForMode(mode: ResolvedTheme): string {
    return FIXED_THEME_PALETTES[mode]
}

export function applyResolvedTheme(root: HTMLElement, theme: ResolvedTheme, paletteId: string) {
    const palette = getMonetPaletteById(paletteId)
    root.dataset.theme = theme
    root.dataset.palette = palette.id
    root.style.setProperty('color-scheme', theme)
    root.style.setProperty('--palette-bg-0', palette.colors.bg0)
    root.style.setProperty('--palette-bg-1', palette.colors.bg1)
    root.style.setProperty('--palette-bg-2', palette.colors.bg2)
    root.style.setProperty('--palette-glow-a', palette.colors.glowA)
    root.style.setProperty('--palette-glow-b', palette.colors.glowB)
    root.style.setProperty('--palette-accent', palette.colors.accent)
    root.style.setProperty('--palette-accent-hover', palette.colors.accentHover)
    root.style.setProperty('--palette-accent-soft', palette.colors.accentSoft)
    root.style.setProperty('--palette-accent-border', palette.colors.accentBorder)
    root.style.setProperty('--palette-button-text', palette.colors.buttonText)
}
