export interface TranscriptColor {
  bg: string
  border: string
  text: string
}

export const TRANSCRIPT_PALETTE: TranscriptColor[] = [
  { bg: 'rgba(147, 197, 253, 0.5)', border: '#2563eb', text: '#1d4ed8' },
  { bg: 'rgba(134, 239, 172, 0.5)', border: '#16a34a', text: '#15803d' },
  { bg: 'rgba(253, 186, 116, 0.5)', border: '#ea580c', text: '#c2410c' },
  { bg: 'rgba(216, 180, 254, 0.5)', border: '#9333ea', text: '#7e22ce' },
  { bg: 'rgba(252, 165, 165, 0.5)', border: '#dc2626', text: '#b91c1c' },
  { bg: 'rgba(103, 232, 249, 0.5)', border: '#0891b2', text: '#0e7490' },
  { bg: 'rgba(253, 224, 71, 0.5)', border: '#ca8a04', text: '#a16207' },
  { bg: 'rgba(244, 114, 182, 0.5)', border: '#db2777', text: '#be185d' },
  { bg: 'rgba(165, 180, 252, 0.5)', border: '#4f46e5', text: '#4338ca' },
  { bg: 'rgba(110, 231, 183, 0.5)', border: '#059669', text: '#047857' },
  { bg: 'rgba(251, 191, 36, 0.5)', border: '#d97706', text: '#b45309' },
  { bg: 'rgba(167, 243, 208, 0.5)', border: '#10b981', text: '#059669' },
]

export function colorAtIndex(index: number): TranscriptColor {
  return TRANSCRIPT_PALETTE[index % TRANSCRIPT_PALETTE.length]
}

/** Next palette index for a newly created transcript in a project. */
export function nextTranscriptColorIndex(existingCount: number): number {
  return existingCount
}

export function getTranscriptColor(transcript: {
  colorIndex?: number
  sortOrder?: number
}): TranscriptColor {
  const index = transcript.colorIndex ?? transcript.sortOrder ?? 0
  return colorAtIndex(index)
}
