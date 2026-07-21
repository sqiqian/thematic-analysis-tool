import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createMemo, deleteMemo, listMemos, updateMemo } from '../db/services'
import type { Code, Memo, MemoScope } from '../types'

interface MemoEditorProps {
  projectId: string
  scope: MemoScope
  entityId?: string
  entityLabel?: string
  code?: Code
  existingMemo: Memo | null
  onClose: () => void
  onSaved: () => void
}

export function MemoEditor({
  projectId,
  scope,
  entityId,
  entityLabel,
  code,
  existingMemo,
  onClose,
  onSaved,
}: MemoEditorProps) {
  const [title, setTitle] = useState(existingMemo?.title ?? '')
  const [content, setContent] = useState(existingMemo?.content ?? '')
  const [allMemos, setAllMemos] = useState<Memo[]>([])
  const [activeId, setActiveId] = useState(existingMemo?.id ?? null)

  useEffect(() => {
    async function load() {
      if (scope === 'code' && code) {
        setAllMemos(await listMemos(projectId, 'code', code.id))
      } else if (scope === 'transcript' && entityId) {
        setAllMemos(await listMemos(projectId, 'transcript', entityId))
      } else {
        setAllMemos(await listMemos(projectId, 'project'))
      }
    }
    load()
  }, [projectId, scope, entityId, code])

  useEffect(() => {
    const memo = allMemos.find((m) => m.id === activeId)
    if (memo) {
      setTitle(memo.title)
      setContent(memo.content)
    } else if (!activeId) {
      setTitle('')
      setContent('')
    }
  }, [activeId, allMemos])

  const scopeLabel =
    scope === 'project'
      ? 'Project memo'
      : scope === 'transcript'
        ? `Transcript memo${entityLabel ? `: ${entityLabel}` : ''}`
        : `Code memo${code ? `: ${code.name}` : ''}`

  const handleSave = async () => {
    if (!title.trim()) return

    if (activeId) {
      await updateMemo(activeId, { title: title.trim(), content })
    } else {
      const memo = await createMemo(
        projectId,
        scope,
        title.trim(),
        content,
        scope === 'transcript' ? entityId : scope === 'code' ? code?.id : undefined,
      )
      setActiveId(memo.id)
    }
    onSaved()
    if (scope === 'code' && code) {
      setAllMemos(await listMemos(projectId, 'code', code.id))
    } else if (scope === 'transcript' && entityId) {
      setAllMemos(await listMemos(projectId, 'transcript', entityId))
    } else {
      setAllMemos(await listMemos(projectId, 'project'))
    }
  }

  const handleNew = () => {
    setActiveId(null)
    setTitle('')
    setContent('')
  }

  const handleDelete = async () => {
    if (!activeId) return
    if (!confirm('Delete this memo?')) return
    await deleteMemo(activeId)
    handleNew()
    onSaved()
    if (scope === 'code' && code) {
      setAllMemos(await listMemos(projectId, 'code', code.id))
    } else if (scope === 'transcript' && entityId) {
      setAllMemos(await listMemos(projectId, 'transcript', entityId))
    } else {
      setAllMemos(await listMemos(projectId, 'project'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg border border-zinc-200 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <div>
            <p className="text-sm font-medium text-zinc-900">{scopeLabel}</p>
            <p className="text-xs text-zinc-400">Markdown supported</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700">
            <X size={18} />
          </button>
        </div>

        {allMemos.length > 0 && (
          <div className="flex gap-1 px-4 py-2 border-b border-zinc-100 overflow-x-auto">
            {allMemos.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                className={`shrink-0 px-2 py-1 text-xs rounded ${
                  activeId === m.id ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {m.title}
              </button>
            ))}
            <button
              type="button"
              onClick={handleNew}
              className="shrink-0 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 rounded"
            >
              + New
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Memo title"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your reflexive notes…"
            rows={12}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300 leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!activeId}
            className="text-xs text-red-500 hover:text-red-600 disabled:opacity-30"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
