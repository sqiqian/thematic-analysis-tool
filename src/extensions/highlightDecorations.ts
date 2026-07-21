import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface HighlightDecoration {
  id: string
  from: number
  to: number
  codeNames: string[]
  transcriptTitle: string
  backgroundColor: string
  borderColor: string
}

export const highlightPluginKey = new PluginKey('highlights')

function buildOffsetMap(
  doc: { descendants: (fn: (node: { isText: boolean; text?: string }, pos: number) => void) => void },
) {
  const plainToPos: number[] = []
  let plainIndex = 0

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        plainToPos[plainIndex] = pos + i
        plainIndex++
      }
    }
  })

  return { plainToPos, plainLength: plainIndex }
}

function posFromPlainOffset(
  plainToPos: number[],
  offset: number,
  docSize: number,
  exclusive = false,
): number {
  if (plainToPos.length === 0) return 1
  if (exclusive) {
    if (offset <= 0) return plainToPos[0]
    if (offset >= plainToPos.length) return docSize - 1
    return plainToPos[offset] ?? docSize - 1
  }
  if (offset <= 0) return plainToPos[0]
  if (offset >= plainToPos.length) return docSize - 1
  return plainToPos[offset] ?? docSize - 1
}

function buildDecorationSet(
  doc: { descendants: (fn: (node: { isText: boolean; text?: string }, pos: number) => void) => void; content: { size: number } },
  highlights: HighlightDecoration[],
): DecorationSet {
  if (!highlights.length) return DecorationSet.empty

  const { plainToPos } = buildOffsetMap(doc)
  const decorations: Decoration[] = []

  for (const h of highlights) {
    const from = posFromPlainOffset(plainToPos, h.from, doc.content.size, false)
    const to = posFromPlainOffset(plainToPos, h.to, doc.content.size, true)
    if (from >= to) continue

    const tooltip =
      h.codeNames.length > 0
        ? `Participant: ${h.transcriptTitle} · Codes: ${h.codeNames.join(', ')}`
        : `Participant: ${h.transcriptTitle}`

    decorations.push(
      Decoration.inline(from, to, {
        class: `qda-highlight qda-hl-${h.id}`,
        style: `background: ${h.backgroundColor}; box-decoration-break: clone; -webkit-box-decoration-break: clone; border-bottom: 2px solid ${h.borderColor}; cursor: pointer;`,
        'data-highlight-id': h.id,
        title: tooltip,
      }),
    )
  }

  return DecorationSet.create(doc as Parameters<typeof DecorationSet.create>[0], decorations)
}

export const HighlightDecorations = Extension.create({
  name: 'highlightDecorations',

  addOptions() {
    return {
      highlights: [] as HighlightDecoration[],
      onHighlightClick: (_id: string, _event: MouseEvent) => {},
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: highlightPluginKey,
        state: {
          init: (_, state) => buildDecorationSet(state.doc, extension.options.highlights),
          apply(tr, oldSet, _oldState, newState) {
            const meta = tr.getMeta(highlightPluginKey) as
              | { highlights?: HighlightDecoration[] }
              | undefined
            if (meta?.highlights) {
              return buildDecorationSet(newState.doc, meta.highlights)
            }
            if (tr.docChanged) {
              return buildDecorationSet(newState.doc, extension.options.highlights)
            }
            return oldSet.map(tr.mapping, newState.doc)
          },
        },
        props: {
          decorations(state) {
            return highlightPluginKey.getState(state) ?? DecorationSet.empty
          },
          handleDOMEvents: {
            click(_view, event) {
              const target = event.target as HTMLElement
              const el =
                target.closest('[data-highlight-id]') ??
                target.closest('[class*="qda-hl-"]')
              const highlightId =
                (el as HTMLElement | null)?.dataset?.highlightId ??
                (el as HTMLElement | null)?.className
                  ?.match(/qda-hl-([a-f0-9-]+)/i)?.[1]
              if (highlightId) {
                extension.options.onHighlightClick(highlightId, event)
                return true
              }
              return false
            },
          },
        },
      }),
    ]
  },
})

export function selectionToPlainOffsets(
  doc: { descendants: (fn: (node: { isText: boolean; text?: string }, pos: number) => void) => void },
  from: number,
  to: number,
): { start: number; end: number } {
  let plainIndex = 0
  let start = 0
  let end = 0
  let startSet = false
  let endSet = false

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const textStart = plainIndex
    const nodeFrom = pos
    const nodeTo = pos + node.text.length

    if (!startSet && from >= nodeFrom && from <= nodeTo) {
      start = textStart + Math.max(0, from - nodeFrom)
      startSet = true
    }
    if (!endSet && to >= nodeFrom && to <= nodeTo) {
      end = textStart + Math.max(0, to - nodeFrom)
      endSet = true
    }

    plainIndex += node.text.length
  })

  return { start, end: endSet ? end : start }
}

export function dispatchHighlightUpdate(
  view: { state: { tr: import('@tiptap/pm/state').Transaction }; dispatch: (tr: import('@tiptap/pm/state').Transaction) => void },
  highlights: HighlightDecoration[],
): void {
  const tr = view.state.tr.setMeta(highlightPluginKey, { highlights })
  view.dispatch(tr)
}
