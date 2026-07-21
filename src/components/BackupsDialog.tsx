import { useEffect, useState } from 'react'
import { BookMarked, History, Plus, RotateCcw, X } from 'lucide-react'
import {
  codebookReasonLabel,
  createCodebookBackup,
  formatBackupTime,
  listCodebookBackups,
  listProjectBackups,
  reasonLabel,
  restoreCodebookBackup,
  restoreProjectBackup,
} from '../db/backup'
import type { CodebookBackup, ProjectBackup } from '../types/backup'
import { ConfirmDialog } from './ConfirmDialog'

type Tab = 'project' | 'codebook'

interface BackupsDialogProps {
  projectId: string
  onClose: () => void
  onRestored: () => void
}

export function BackupsDialog({ projectId, onClose, onRestored }: BackupsDialogProps) {
  const [tab, setTab] = useState<Tab>('project')
  const [projectBackups, setProjectBackups] = useState<ProjectBackup[]>([])
  const [codebookBackups, setCodebookBackups] = useState<CodebookBackup[]>([])
  const [pendingProjectRestore, setPendingProjectRestore] = useState<ProjectBackup | null>(null)
  const [pendingCodebookRestore, setPendingCodebookRestore] = useState<CodebookBackup | null>(null)
  const [restoring, setRestoring] = useState(false)

  const load = async () => {
    setProjectBackups(await listProjectBackups(projectId))
    setCodebookBackups(await listCodebookBackups(projectId))
  }

  useEffect(() => {
    load()
  }, [projectId])

  const handleRestoreProject = async () => {
    if (!pendingProjectRestore) return
    setRestoring(true)
    const result = await restoreProjectBackup(pendingProjectRestore.id)
    setRestoring(false)
    if (!result.ok) {
      alert(result.error)
      return
    }
    setPendingProjectRestore(null)
    onRestored()
    onClose()
  }

  const handleRestoreCodebook = async () => {
    if (!pendingCodebookRestore) return
    setRestoring(true)
    const result = await restoreCodebookBackup(pendingCodebookRestore.id)
    setRestoring(false)
    if (!result.ok) {
      alert(result.error)
      return
    }
    setPendingCodebookRestore(null)
    onRestored()
    onClose()
  }

  const handleManualCodebookBackup = async () => {
    await createCodebookBackup(projectId, 'Manual backup', 'manual')
    await load()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-zinc-200 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <History size={16} className="text-zinc-500" />
              <h2 className="text-sm font-medium text-zinc-900">Backups</h2>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700">
              <X size={18} />
            </button>
          </div>

          <div className="flex border-b border-zinc-100 px-2 pt-2 gap-1">
            <button
              type="button"
              onClick={() => setTab('project')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
                tab === 'project'
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Full project
            </button>
            <button
              type="button"
              onClick={() => setTab('codebook')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
                tab === 'codebook'
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <BookMarked size={12} />
              Codebook
            </button>
          </div>

          {tab === 'project' ? (
            <p className="px-4 py-2 text-xs text-zinc-500 border-b border-zinc-100">
              Full snapshots while editing transcripts and before deletes. Restores everything.
            </p>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 gap-2">
              <p className="text-xs text-zinc-500 flex-1">
                Code hierarchy only. Saved when you edit, rename, move, or delete codes.
              </p>
              <button
                type="button"
                onClick={handleManualCodebookBackup}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-600 border border-zinc-200 rounded-md hover:bg-zinc-50 shrink-0"
              >
                <Plus size={11} />
                Save now
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {tab === 'project' ? (
              projectBackups.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-8">No project backups yet</p>
              ) : (
                <ul className="space-y-1">
                  {projectBackups.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-zinc-50 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-800 truncate">{b.label}</p>
                        <p className="text-[11px] text-zinc-400">
                          {formatBackupTime(b.createdAt)} · {reasonLabel(b.reason)} ·{' '}
                          {b.snapshot.transcripts.length} transcript
                          {b.snapshot.transcripts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingProjectRestore(b)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 rounded-md transition-all shrink-0"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : codebookBackups.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">No codebook backups yet</p>
            ) : (
              <ul className="space-y-1">
                {codebookBackups.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-zinc-50 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800 truncate">{b.label}</p>
                      <p className="text-[11px] text-zinc-400">
                        {formatBackupTime(b.createdAt)} · {codebookReasonLabel(b.reason)} ·{' '}
                        {b.codes.length} code{b.codes.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingCodebookRestore(b)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 rounded-md transition-all shrink-0"
                    >
                      <RotateCcw size={12} />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {pendingProjectRestore && (
        <ConfirmDialog
          title="Restore full project backup?"
          message={`This will replace your entire project with the version from ${formatBackupTime(pendingProjectRestore.createdAt)} (${pendingProjectRestore.label}). Current data will be overwritten.`}
          confirmLabel={restoring ? 'Restoring…' : 'Restore project'}
          onConfirm={handleRestoreProject}
          onCancel={() => setPendingProjectRestore(null)}
        />
      )}

      {pendingCodebookRestore && (
        <ConfirmDialog
          title="Restore codebook backup?"
          message={`This will replace your codebook with the version from ${formatBackupTime(pendingCodebookRestore.createdAt)} (${pendingCodebookRestore.label}). Transcripts are kept, but coding on removed codes will be cleared.`}
          confirmLabel={restoring ? 'Restoring…' : 'Restore codebook'}
          onConfirm={handleRestoreCodebook}
          onCancel={() => setPendingCodebookRestore(null)}
        />
      )}
    </>
  )
}
