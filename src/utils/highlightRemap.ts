/**
 * Locates a coded excerpt in updated plain text, preferring the occurrence
 * nearest the previous offset so highlights follow words after edits elsewhere.
 */
export function findExcerptInText(
  plainText: string,
  excerpt: string,
  hintOffset: number,
): { start: number; end: number } | null {
  const needle = excerpt.trim()
  if (!needle || !plainText) return null

  let best: { start: number; end: number; distance: number } | null = null
  let searchFrom = 0

  while (searchFrom <= plainText.length) {
    const idx = plainText.indexOf(needle, searchFrom)
    if (idx === -1) break

    const distance = Math.abs(idx - hintOffset)
    if (!best || distance < best.distance) {
      best = { start: idx, end: idx + needle.length, distance }
    }
    searchFrom = idx + 1
  }

  return best ? { start: best.start, end: best.end } : null
}

export function planHighlightRemap(
  highlights: { id: string; excerpt: string; startOffset: number; endOffset: number }[],
  _oldPlainText: string,
  newPlainText: string,
): {
  updates: { id: string; startOffset: number; endOffset: number; excerpt: string }[]
  removeIds: string[]
} {
  const updates: { id: string; startOffset: number; endOffset: number; excerpt: string }[] = []
  const removeIds: string[] = []

  for (const h of highlights) {
    const found = findExcerptInText(newPlainText, h.excerpt, h.startOffset)
    if (found) {
      const newExcerpt = newPlainText.slice(found.start, found.end)
      if (
        found.start !== h.startOffset ||
        found.end !== h.endOffset ||
        newExcerpt !== h.excerpt
      ) {
        updates.push({
          id: h.id,
          startOffset: found.start,
          endOffset: found.end,
          excerpt: newExcerpt,
        })
      }
    } else {
      removeIds.push(h.id)
    }
  }

  return { updates, removeIds }
}
