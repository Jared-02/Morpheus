// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const originalProxyTarget = process.env.VITE_API_PROXY_TARGET

const loadViteConfig = async () => {
    vi.resetModules()
    const module = await import('./vite.config')
    return module.default
}

afterEach(() => {
    if (originalProxyTarget === undefined) {
        delete process.env.VITE_API_PROXY_TARGET
    } else {
        process.env.VITE_API_PROXY_TARGET = originalProxyTarget
    }
})

describe('vite dev proxy target', () => {
    it('defaults the /api proxy to the backend dev port', async () => {
        delete process.env.VITE_API_PROXY_TARGET

        const config = await loadViteConfig()

        expect((config as any).server?.proxy?.['/api']?.target).toBe('http://localhost:8000')
    })

    it('allows overriding the proxy target via VITE_API_PROXY_TARGET', async () => {
        process.env.VITE_API_PROXY_TARGET = 'http://localhost:9100'

        const config = await loadViteConfig()

        expect((config as any).server?.proxy?.['/api']?.target).toBe('http://localhost:9100')
    })
})
