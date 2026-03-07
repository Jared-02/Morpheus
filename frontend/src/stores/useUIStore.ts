import { create } from 'zustand'
import { getFixedPaletteForMode, type ThemeMode } from '../theme/themeSystem'

const THEME_STORAGE_KEY = 'ui-theme-preferences'

type ThemePreferences = {
    themeMode?: ThemeMode
    themePaletteId?: string
}

function loadThemePreferences(): Required<ThemePreferences> {
    try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY)
        if (!raw) return { themeMode: 'light', themePaletteId: 'water-lilies-dawn' }
        const parsed = JSON.parse(raw) as ThemePreferences
        return {
            themeMode:
                parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'system'
                    ? parsed.themeMode
                    : 'light',
            themePaletteId: typeof parsed.themePaletteId === 'string' && parsed.themePaletteId.trim()
                ? parsed.themePaletteId
                : 'water-lilies-dawn',
        }
    } catch {
        return { themeMode: 'light', themePaletteId: 'water-lilies-dawn' }
    }
}

function saveThemePreferences(preferences: Required<ThemePreferences>) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences))
    } catch {
    }
}

const initialThemePreferences = loadThemePreferences()

interface UIStore {
    sidebarCollapsed: boolean
    readingMode: boolean
    shortcutHelpOpen: boolean
    themeMode: ThemeMode
    themePaletteId: string
    /** Sidebar state saved before entering reading mode, restored on exit */
    _savedSidebarCollapsed: boolean | null

    toggleSidebar: () => void
    toggleReadingMode: () => void
    enterReadingMode: () => void
    exitReadingMode: () => void
    toggleShortcutHelp: () => void
    setThemeMode: (mode: ThemeMode) => void
    setThemePalette: (paletteId: string) => void
}

export const useUIStore = create<UIStore>((set) => ({
    sidebarCollapsed: false,
    readingMode: false,
    shortcutHelpOpen: false,
    themeMode: initialThemePreferences.themeMode,
    themePaletteId: initialThemePreferences.themePaletteId,
    _savedSidebarCollapsed: null,

    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

    toggleReadingMode: () =>
        set((s) => {
            if (s.readingMode) {
                // exiting
                return {
                    readingMode: false,
                    sidebarCollapsed: s._savedSidebarCollapsed ?? s.sidebarCollapsed,
                    _savedSidebarCollapsed: null,
                }
            }
            // entering
            return {
                readingMode: true,
                _savedSidebarCollapsed: s.sidebarCollapsed,
                sidebarCollapsed: true,
            }
        }),

    enterReadingMode: () =>
        set((s) => {
            if (s.readingMode) return s
            return {
                readingMode: true,
                _savedSidebarCollapsed: s.sidebarCollapsed,
                sidebarCollapsed: true,
            }
        }),

    exitReadingMode: () =>
        set((s) => {
            if (!s.readingMode) return s
            return {
                readingMode: false,
                sidebarCollapsed: s._savedSidebarCollapsed ?? s.sidebarCollapsed,
                _savedSidebarCollapsed: null,
            }
        }),

    toggleShortcutHelp: () => set((s) => ({ shortcutHelpOpen: !s.shortcutHelpOpen })),

    setThemeMode: (themeMode) =>
        set((s) => {
            const fixedPaletteId = themeMode === 'dark' || themeMode === 'light'
                ? getFixedPaletteForMode(themeMode)
                : s.themePaletteId
            saveThemePreferences({ themeMode, themePaletteId: fixedPaletteId })
            return { themeMode, themePaletteId: fixedPaletteId }
        }),

    setThemePalette: (themePaletteId) =>
        set((s) => {
            saveThemePreferences({ themeMode: s.themeMode, themePaletteId })
            return { themePaletteId }
        }),
}))
