import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Quote } from 'lucide-react'
import {
  createHighlight,
  getHighlightsWithCodes,
  getTranscript,
  updateTranscript,
} from '../db/services'
import { maybeAutoBackup } from '../db/backup'
import {
  HighlightDecorations,
  dispatchHighlightUpdate,
  selectionToPlainOffsets,
  type HighlightDecoration,
} from '../extensions/highlightDecorations'
import type { Transcript } from '../types'
import { getTranscriptColor } from '../utils/transcriptColors'
import {
  clampPopoverPosition,
  CodeAssignPopover,
  type CodeAssignPopoverState,
} from './CodeAssignPopover'

interface TranscriptEditorProps {
  transcriptId: string
  projectId: string
  pendingCodeId: string | null
  onPendingCodeConsumed: () => void
  refreshKey: number
  onDataChanged: () => void
}

export function TranscriptEditor({
  transcriptId,
  projectId,
  pendingCodeId,
  onPendingCodeConsumed,
  refreshKey,
  onDataChanged,
}: TranscriptEditorProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [highlightData, setHighlightData] = useState<HighlightDecoration[]>([])
  const [assignPopover, setAssignPopover] = useState<CodeAssignPopoverState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressSelectionPopup = useRef(false)

  const loadHighlights = useCallback(async () => {
    const items = await getHighlightsWithCodes(transcriptId)
    const t = await getTranscript(transcriptId)
    const color = t ? getTranscriptColor(t) : getTranscriptColor({ colorIndex: 0 })
    const title = t?.title ?? 'Participant'

    setHighlightData(
      items.map(({ highlight, codes }) => ({
        id: highlight.id,
        from: highlight.startOffset,
        to: highlight.endOffset,
        codeNames: codes.map((c) => c.name),
        transcriptTitle: title,
        backgroundColor: color.bg,
        borderColor: color.border,
      })),
    )
  }, [transcriptId])

  const loadTranscript = useCallback(async () => {
    const t = await getTranscript(transcriptId)
    setTranscript(t ?? null)
    await loadHighlights()
  }, [transcriptId, loadHighlights])

  useEffect(() => {
    loadTranscript()
  }, [loadTranscript, refreshKey])

  const openPopoverForSelection = useCallback(async (editor: NonNullable<ReturnType<typeof useEditor>>) => {
    const { from, to, empty } = editor.state.selection
    if (empty) return

    const { start, end } = selectionToPlainOffsets(editor.state.doc, from, to)
    const excerpt = editor.state.doc.textBetween(from, to, ' ')
    if (!excerpt.trim()) return

    const position = clampPopoverPosition(editor.view, from, to)

    const items = await getHighlightsWithCodes(transcriptId)
    const existing = items.find(
      ({ highlight }) => highlight.startOffset === start && highlight.endOffset === end,
    )

    setAssignPopover({
      startOffset: start,
      endOffset: end,
      excerpt,
      position,
      highlightId: existing?.highlight.id,
    })
  }, [transcriptId])

  const openPopoverForHighlight = useCallback(
    async (highlightId: string, event: MouseEvent) => {
      const items = await getHighlightsWithCodes(transcriptId)
      const item = items.find(({ highlight }) => highlight.id === highlightId)
      if (!item) return

      const { highlight } = item
      const position = {
        x: Math.max(12, Math.min(event.clientX - 160, window.innerWidth - 332)),
        y: Math.max(12, Math.min(event.clientY + 8, window.innerHeight - 372)),
      }

      setAssignPopover({
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
        excerpt: highlight.excerpt,
        position,
        highlightId,
      })
    },
    [transcriptId],
  )

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Paste or type your transcript…' }),
        HighlightDecorations.configure({
          highlights: highlightData,
          onHighlightClick: () => {},
        }),
      ],
      content: transcript?.content ?? '<p></p>',
      editorProps: {
        attributes: {
          class: 'prose prose-zinc max-w-none focus:outline-none',
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          const html = ed.getHTML()
          const plainText = ed.getText()
          await updateTranscript(transcriptId, { content: html, plainText })
          await loadHighlights()
          onDataChanged()
          const t = await getTranscript(transcriptId)
          if (t) await maybeAutoBackup(projectId, t.title)
        }, 500)
      },
    },
    [transcriptId],
  )

  useEffect(() => {
    if (!editor) return

    const resolveHighlightId = (target: EventTarget | null): string | null => {
      const el = target as HTMLElement
      const node =
        el.closest?.('[data-highlight-id]') ?? el.closest?.('[class*="qda-hl-"]')
      if (!node) return null
      const htmlEl = node as HTMLElement
      if (htmlEl.dataset.highlightId) return htmlEl.dataset.highlightId
      const match = htmlEl.className?.match(/qda-hl-([a-f0-9-]+)/i)
      return match?.[1] ?? null
    }

    const handleMouseUp = (event: MouseEvent) => {
      const highlightId = resolveHighlightId(event.target)

      if (highlightId) {
        event.preventDefault()
        suppressSelectionPopup.current = true
        openPopoverForHighlight(highlightId, event)
        return
      }

      if (suppressSelectionPopup.current) {
        suppressSelectionPopup.current = false
        return
      }

      requestAnimationFrame(() => {
        if (!editor.state.selection.empty) {
          openPopoverForSelection(editor)
        }
      })
    }

    const handleClick = (event: MouseEvent) => {
      const highlightId = resolveHighlightId(event.target)
      if (highlightId) {
        event.preventDefault()
        event.stopPropagation()
        openPopoverForHighlight(highlightId, event)
      }
    }

    const dom = editor.view.dom
    dom.addEventListener('mouseup', handleMouseUp)
    dom.addEventListener('click', handleClick, true)
    return () => {
      dom.removeEventListener('mouseup', handleMouseUp)
      dom.removeEventListener('click', handleClick, true)
    }
  }, [editor, openPopoverForSelection, openPopoverForHighlight])

  useEffect(() => {
    if (!editor || !transcript) return
    const current = editor.getHTML()
    if (current !== transcript.content) {
      editor.commands.setContent(transcript.content, { emitUpdate: false })
    }
  }, [editor, transcript?.id])

  useEffect(() => {
    if (!editor) return
    editor.extensionManager.extensions.forEach((ext) => {
      if (ext.name === 'highlightDecorations') {
        ext.options.highlights = highlightData
        ext.options.onHighlightClick = (id: string, event: MouseEvent) => {
          suppressSelectionPopup.current = true
          openPopoverForHighlight(id, event)
        }
      }
    })
    dispatchHighlightUpdate(editor.view, highlightData)
  }, [editor, highlightData, openPopoverForHighlight])

  const applyCodeToSelection = useCallback(
    async (codeId: string) => {
      if (!editor) return
      const { from, to, empty } = editor.state.selection
      if (empty) return

      const { start, end } = selectionToPlainOffsets(editor.state.doc, from, to)
      const excerpt = editor.state.doc.textBetween(from, to, ' ')
      await createHighlight(transcriptId, start, end, excerpt, codeId)
      await loadHighlights()
      onDataChanged()
    },
    [editor, transcriptId, loadHighlights, onDataChanged],
  )

  useEffect(() => {
    if (pendingCodeId && editor) {
      applyCodeToSelection(pendingCodeId)
      onPendingCodeConsumed()
    }
  }, [pendingCodeId, applyCodeToSelection, onPendingCodeConsumed, editor])

  const toolbar = useMemo(
    () =>
      editor && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-zinc-100">
          {[
            { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
            { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
            { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
            { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
            { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
          ].map(({ icon: Icon, action, active }) => (
            <button
              key={Icon.displayName}
              type="button"
              onClick={action}
              className={`p-1.5 rounded ${active ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      ),
    [editor],
  )

  if (!transcript) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
        Loading transcript…
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-6 py-4 border-b border-zinc-100">
        <input
          type="text"
          value={transcript.title}
          onChange={async (e) => {
            const title = e.target.value
            setTranscript({ ...transcript, title })
            await updateTranscript(transcriptId, { title })
          }}
          className="w-full text-lg font-medium text-zinc-900 bg-transparent focus:outline-none"
        />
        <p className="text-xs text-zinc-400 mt-1">
          Highlight text to assign codes, or click highlighted text to edit codes
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[65ch] mx-auto px-6 py-8">
          <div className="border border-zinc-200 rounded-xl bg-white shadow-sm">
            {toolbar}
            <div className="px-5 py-6 text-[15px] leading-[1.85] text-zinc-800">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {assignPopover && (
        <CodeAssignPopover
          key={assignPopover.highlightId ?? `new-${assignPopover.startOffset}-${assignPopover.endOffset}`}
          projectId={projectId}
          transcriptId={transcriptId}
          state={assignPopover}
          onClose={() => setAssignPopover(null)}
          onHighlightCreated={(highlightId) => {
            setAssignPopover((prev) => (prev ? { ...prev, highlightId } : null))
          }}
          onChanged={async () => {
            await loadHighlights()
            onDataChanged()
          }}
        />
      )}
    </div>
  )
}
