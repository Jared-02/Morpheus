/**
 * First-chapter onboarding utilities.
 *
 * When a project has zero persisted chapters, the WritingConsolePage
 * can enter `?entry=first-chapter` mode to guide the user through
 * generating their first chapter via the batch SSE endpoint (chapter_count=1).
 */

export function isFirstChapterEntry(search?: URLSearchParams | string): boolean {
    const params =
        search instanceof URLSearchParams
            ? search
            : new URLSearchParams(search ?? window.location.search)
    return params.get('entry') === 'first-chapter'
}

export function clearFirstChapterEntry(
    setSearchParams?: (updater: (prev: URLSearchParams) => URLSearchParams, opts?: { replace?: boolean }) => void,
): void {
    if (setSearchParams) {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('entry')
            return next
        }, { replace: true })
    } else {
        const url = new URL(window.location.href)
        url.searchParams.delete('entry')
        window.history.replaceState({}, '', url.toString())
    }
}
