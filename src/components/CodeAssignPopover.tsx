import { useEffect, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import {
  addCodeToHighlight,
  createCode,
  createHighlight,
  getCodePath,
  listCodes,
  listHighlightCodes,
  removeCodeFromHighlight,
} from '../db/services'
import type { Code } from '../types'
import { codeColor } from '../utils/highlightSegments'

export interface CodeAssignPopoverState {
  startOffset: number
  endOffset: number
  excerpt: string
  position: { x: number; y: number }
  highlightId?: string
}

interface CodeAssignPopoverProps {
  projectId: string
  transcriptId: string
  state: CodeAssignPopoverState
  onClose: () => void
  onChanged: () => void
  onHighlightCreated: (highlightId: string) => void
}

export function CodeAssignPopover({
  projectId,
  transcriptId,
  state,
  onClose,
  onChanged,
  onHighlightCreated,
}: CodeAssignPopoverProps) {
  const [codes, setCodes] = useState<Code[]>([])
  const [appliedCodeIds, setAppliedCodeIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [newCodeName, setNewCodeName] = useState('')
  const [creating, setCreating] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const highlightId = state.highlightId

  useEffect(() => {
    async function load() {
      const allCodes = await listCodes(projectId)
      setCodes(allCodes)
      if (highlightId) {
        const links = await listHighlightCodes(highlightId)
        setAppliedCodeIds(links.map((l) => l.codeId))
      } else {
        setAppliedCodeIds([])
      }
    }
    load()
    searchRef.current?.focus()
  }, [projectId, highlightId])

  const appliedCodes = codes.filter((c) => appliedCodeIds.includes(c.id))
  const q = search.toLowerCase().trim()
  const filtered = codes.filter(
    (c) =>
      !appliedCodeIds.includes(c.id) &&
      (c.name.toLowerCase().includes(q) || getCodePath(c, codes).toLowerCase().includes(q)),
  )

  const handleAdd = async (codeId: string) => {
    try {
      if (highlightId) {
        await addCodeToHighlight(highlightId, codeId)
        setAppliedCodeIds((prev) => [...prev, codeId])
      } else {
        const highlight = await createHighlight(
          transcriptId,
          state.startOffset,
          state.endOffset,
          state.excerpt,
          codeId,
        )
        onHighlightCreated(highlight.id)
        setAppliedCodeIds([codeId])
      }
      setSearch('')
      onChanged()
    } catch (err) {
      console.error('Failed to assign code:', err)
    }
  }

  const handleRemove = async (codeId: string) => {
    if (!highlightId) return
    await removeCodeFromHighlight(highlightId, codeId)
    const remaining = appliedCodeIds.filter((id) => id !== codeId)
    setAppliedCodeIds(remaining)
    onChanged()
    if (remaining.length === 0) {
      onClose()
    }
  }

  const handleCreateCode = async () => {
    const name = newCodeName.trim()
    if (!name) return
    setCreating(true)
    const code = await createCode(projectId, name, null)
    setCodes((prev) => [...prev, code])
    setNewCodeName('')
    await handleAdd(code.id)
    setCreating(false)
  }

  const excerptPreview =
    state.excerpt.length > 120 ? `${state.excerpt.slice(0, 120)}…` : state.excerpt

  const isEditing = Boolean(highlightId)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ left: state.position.x, top: state.position.y, maxHeight: 'min(22rem, calc(100vh - 2rem))' }}
        role="dialog"
        aria-label={isEditing ? 'Edit codes' : 'Assign codes'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-zinc-100 bg-zinc-50/80">
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-700">
              {isEditing ? 'Edit codes' : 'Assign codes'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">
              "{excerptPreview}"
            </p>
            {isEditing && (
              <p className="text-[10px] text-zinc-400 mt-1">
                Remove codes with × or search to add more
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-zinc-400 hover:text-zinc-700 rounded"
          >
            <X size={14} />
          </button>
        </div>

        {appliedCodes.length > 0 && (
          <div className="px-2 pt-2 flex flex-wrap gap-1">
            {appliedCodes.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] bg-zinc-100 text-zinc-700 rounded-full"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: codeColor(c.id, c.color) }}
                />
                {c.name}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    className="p-0.5 text-zinc-400 hover:text-red-500 rounded-full"
                    title="Remove code"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="p-2 border-b border-zinc-100">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or pick a code…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">
              {codes.length === 0 ? 'No codes yet — create one below' : 'No matching codes'}
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleAdd(c.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 rounded-md"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: codeColor(c.id, c.color) }}
                />
                <span className="truncate">{getCodePath(c, codes)}</span>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-zinc-100 flex gap-1">
          <input
            type="text"
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCode()}
            placeholder="New code name…"
            className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-300"
          />
          <button
            type="button"
            onClick={handleCreateCode}
            disabled={creating || !newCodeName.trim()}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-800 text-white rounded-md hover:bg-zinc-700 disabled:opacity-40"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>
    </>
  )
}

export function clampPopoverPosition(
  editorView: { coordsAtPos: (pos: number) => { left: number; right: number; top: number; bottom: number } },
  from: number,
  to: number,
): { x: number; y: number } {
  const panelWidth = 320
  const panelHeight = 360
  const margin = 12

  const start = editorView.coordsAtPos(from)
  const end = editorView.coordsAtPos(to)

  let x = (start.left + end.right) / 2 - panelWidth / 2
  let y = Math.max(start.bottom, end.bottom) + 8

  if (y + panelHeight > window.innerHeight - margin) {
    y = Math.min(start.top, end.top) - panelHeight - 8
  }

  x = Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin))
  y = Math.max(margin, Math.min(y, window.innerHeight - panelHeight - margin))

  return { x, y }
}
