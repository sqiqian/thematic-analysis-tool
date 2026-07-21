import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, StickyNote, Trash2 } from 'lucide-react'
import { createTranscript, getTranscriptCodingStats, listMemos, listTranscripts } from '../db/services'
import { deleteTranscriptWithBackup } from '../db/backup'
import type { Memo, Transcript } from '../types'
import type { TranscriptDeleteSnapshot } from '../types/backup'
import { getTranscriptColor } from '../utils/transcriptColors'
import { ConfirmDialog } from './ConfirmDialog'

interface LeftSidebarProps {
  projectId: string
  activeTranscriptId: string | null
  onSelectTranscript: (id: string) => void
  onOpenMemo: (memo: Memo | null, scope: 'project' | 'transcript') => void
  onTranscriptDeleted: (deletedId: string, undoSnapshot: TranscriptDeleteSnapshot | null) => void
}

export function LeftSidebar({
  projectId,
  activeTranscriptId,
  onSelectTranscript,
  onOpenMemo,
  onTranscriptDeleted,
}: LeftSidebarProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [projectMemos, setProjectMemos] = useState<Memo[]>([])
  const [transcriptMemos, setTranscriptMemos] = useState<Memo[]>([])
  const [memosOpen, setMemosOpen] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Transcript | null>(null)
  const [deleteStats, setDeleteStats] = useState<{ highlightCount: number; codingCount: number } | null>(
    null,
  )

  const load = async () => {
    setTranscripts(await listTranscripts(projectId))
    setProjectMemos(await listMemos(projectId, 'project'))
    if (activeTranscriptId) {
      setTranscriptMemos(await listMemos(projectId, 'transcript', activeTranscriptId))
    } else {
      setTranscriptMemos([])
    }
  }

  useEffect(() => {
    load()
  }, [projectId, activeTranscriptId])

  useEffect(() => {
    if (!pendingDelete) {
      setDeleteStats(null)
      return
    }
    getTranscriptCodingStats(pendingDelete.id).then(setDeleteStats)
  }, [pendingDelete])

  const handleAddTranscript = async () => {
    const title = newTitle.trim() || `Transcript ${transcripts.length + 1}`
    const t = await createTranscript(projectId, title)
    setNewTitle('')
    await load()
    onSelectTranscript(t.id)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    const undoSnapshot = await deleteTranscriptWithBackup(id)
    setPendingDelete(null)
    await load()
    onTranscriptDeleted(id, undoSnapshot)
  }

  return (
    <div className="p-2 space-y-4">
      <div>
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs text-zinc-500">Transcripts</span>
          <button
            type="button"
            onClick={handleAddTranscript}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded"
            title="Add transcript"
          >
            <Plus size={14} />
          </button>
        </div>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTranscript()}
          placeholder="Add transcript…"
          className="w-full px-2 py-1.5 mb-2 text-xs border border-zinc-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300"
        />
        <ul className="space-y-0.5">
          {transcripts.map((t) => (
            <li key={t.id}>
              <div
                className={`group flex items-center gap-1 rounded-md transition-colors ${
                  activeTranscriptId === t.id
                    ? 'bg-zinc-200/70 text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTranscript(t.id)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left text-sm min-w-0"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getTranscriptColor(t).border }}
                    title="Highlight colour for this participant"
                  />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(t)}
                  className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-zinc-400 hover:text-red-500 rounded shrink-0"
                  title="Delete transcript"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMemosOpen(!memosOpen)}
          className="flex items-center gap-1 px-2 mb-2 text-xs text-zinc-500 w-full"
        >
          {memosOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Memos
        </button>
        {memosOpen && (
          <div className="space-y-3 px-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 px-1">
                  Project
                </span>
                <button
                  type="button"
                  onClick={() => onOpenMemo(null, 'project')}
                  className="p-0.5 text-zinc-400 hover:text-zinc-700"
                >
                  <Plus size={12} />
                </button>
              </div>
              {projectMemos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpenMemo(m, 'project')}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 rounded"
                >
                  <StickyNote size={11} className="text-zinc-400 shrink-0" />
                  <span className="truncate">{m.title}</span>
                </button>
              ))}
            </div>

            {activeTranscriptId && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 px-1">
                    Transcript
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenMemo(null, 'transcript')}
                    className="p-0.5 text-zinc-400 hover:text-zinc-700"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {transcriptMemos.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpenMemo(m, 'transcript')}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 rounded"
                  >
                    <StickyNote size={11} className="text-zinc-400 shrink-0" />
                    <span className="truncate">{m.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={
            deleteStats && deleteStats.codingCount > 0
              ? 'Delete coded transcript?'
              : 'Delete transcript?'
          }
          message={
            deleteStats && deleteStats.codingCount > 0
              ? `"${pendingDelete.title}" has ${deleteStats.highlightCount} highlighted excerpt${deleteStats.highlightCount !== 1 ? 's' : ''} with ${deleteStats.codingCount} code assignment${deleteStats.codingCount !== 1 ? 's' : ''}. Deleting will permanently remove this participant's text and all of that coded data. A backup will be saved and you can undo for 30 seconds.`
              : `"${pendingDelete.title}" will be deleted along with any memos attached to it. A backup will be saved and you can undo for 30 seconds.`
          }
          confirmLabel="Delete transcript"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
