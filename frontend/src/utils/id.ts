let fallbackCounter = 0

function getCrypto(): Crypto | undefined {
    if (typeof globalThis === 'undefined') return undefined
    return globalThis.crypto
}

function createUuidLikeFromRandomValues(randomValues: Uint8Array): string {
    randomValues[6] = (randomValues[6] & 0x0f) | 0x40
    randomValues[8] = (randomValues[8] & 0x3f) | 0x80

    const hex = Array.from(randomValues, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function generateId(): string {
    const cryptoObj = getCrypto()
    if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID()
    }

    if (cryptoObj?.getRandomValues) {
        const bytes = new Uint8Array(16)
        cryptoObj.getRandomValues(bytes)
        return createUuidLikeFromRandomValues(bytes)
    }

    fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER
    return `${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
