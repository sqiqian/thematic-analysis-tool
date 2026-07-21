export interface HighlightSegment {
  start: number
  end: number
  text: string
  codeIds: string[]
}

/**
 * Splits plain text into segments at every highlight boundary so overlapping
 * ranges render as a single span carrying multiple code IDs.
 */
export function buildHighlightSegments(
  plainText: string,
  highlights: { startOffset: number; endOffset: number; codeIds: string[] }[],
): HighlightSegment[] {
  if (!plainText) return []

  const boundaries = new Set<number>([0, plainText.length])
  for (const h of highlights) {
    boundaries.add(Math.max(0, h.startOffset))
    boundaries.add(Math.min(plainText.length, h.endOffset))
  }

  const points = [...boundaries].sort((a, b) => a - b)
  const segments: HighlightSegment[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    if (start === end) continue

    const codeIds = highlights
      .filter((h) => h.startOffset <= start && h.endOffset >= end)
      .flatMap((h) => h.codeIds)

    const uniqueCodeIds = [...new Set(codeIds)]
    segments.push({
      start,
      end,
      text: plainText.slice(start, end),
      codeIds: uniqueCodeIds,
    })
  }

  return segments
}

export function blendHighlightColors(colors: string[]): string {
  if (colors.length === 0) return 'transparent'
  if (colors.length === 1) return colors[0]
  return `linear-gradient(to bottom, ${colors.map((c, i) => `${c} ${(i / colors.length) * 100}%, ${c} ${((i + 1) / colors.length) * 100}%`).join(', ')})`
}

export const DEFAULT_CODE_COLORS = [
  'rgba(161, 161, 170, 0.35)',
  'rgba(113, 113, 122, 0.35)',
  'rgba(82, 82, 91, 0.35)',
  'rgba(63, 63, 70, 0.35)',
  'rgba(120, 113, 108, 0.35)',
  'rgba(100, 116, 139, 0.35)',
]

export function codeColor(codeId: string, customColor?: string): string {
  if (customColor) return customColor
  let hash = 0
  for (let i = 0; i < codeId.length; i++) {
    hash = codeId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return DEFAULT_CODE_COLORS[Math.abs(hash) % DEFAULT_CODE_COLORS.length]
}
