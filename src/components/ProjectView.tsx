import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, History, LayoutGrid, FileText } from 'lucide-react'
import { buildExportRows, downloadCSV, downloadJSON, getProject } from '../db/services'
import { restoreTranscriptDelete, restoreCodeDelete } from '../db/backup'
import type { Code, Memo, Project, ViewMode } from '../types'
import type { CodeDeleteSnapshot, TranscriptDeleteSnapshot } from '../types/backup'
import { BackupsDialog } from './BackupsDialog'
import { CollapsibleSidebar } from './CollapsibleSidebar'
import { LeftSidebar } from './LeftSidebar'
import { MemoEditor } from './MemoEditor'
import { RetrievalView } from './RetrievalView'
import { RightSidebar } from './RightSidebar'
import { TranscriptEditor } from './TranscriptEditor'
import { UndoToast } from './UndoToast'

interface ProjectViewProps {
  projectId: string
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null)
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [pendingCodeId, setPendingCodeId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showBackups, setShowBackups] = useState(false)
  const [undoDelete, setUndoDelete] = useState<{
    snapshot: TranscriptDeleteSnapshot
    message: string
  } | null>(null)
  const [undoCodeDelete, setUndoCodeDelete] = useState<{
    snapshot: CodeDeleteSnapshot
    message: string
  } | null>(null)
  const [memoEditor, setMemoEditor] = useState<{
    scope: 'project' | 'transcript' | 'code'
    memo: Memo | null
    code?: Code
  } | null>(null)

  useEffect(() => {
    getProject(projectId).then((p) => setProject(p ?? null))
  }, [projectId])

  const bump = () => setRefreshKey((k) => k + 1)

  const handleUndoDelete = useCallback(async () => {
    if (!undoDelete) return
    await restoreTranscriptDelete(undoDelete.snapshot)
    setActiveTranscriptId(undoDelete.snapshot.transcript.id)
    setUndoDelete(null)
    bump()
  }, [undoDelete])

  const handleUndoCodeDelete = useCallback(async () => {
    if (!undoCodeDelete) return
    await restoreCodeDelete(undoCodeDelete.snapshot)
    setSelectedCodeId(undoCodeDelete.snapshot.code.id)
    setUndoCodeDelete(null)
    bump()
  }, [undoCodeDelete])

  const handleSelectCode = (codeId: string | null) => {
    setSelectedCodeId(codeId)
    if (codeId) setViewMode('retrieval')
  }

  const handleAssignCode = (codeId: string) => {
    if (viewMode === 'retrieval') {
      setViewMode('editor')
    }
    setPendingCodeId(codeId)
  }

  const handleExport = async (format: 'csv' | 'json') => {
    const rows = await buildExportRows(projectId)
    const slug = project?.title.replace(/\s+/g, '-').toLowerCase() ?? 'export'
    if (format === 'csv') {
      downloadCSV(rows, `${slug}-thematic-framework.csv`)
    } else {
      downloadJSON(rows, `${slug}-thematic-framework.json`)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-200 bg-white shrink-0">
        <Link
          to="/"
          className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-medium text-zinc-900 truncate flex-1">
          {project?.title ?? 'Loading…'}
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setViewMode('editor')
              setSelectedCodeId(null)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              viewMode === 'editor'
                ? 'bg-zinc-200 text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            <FileText size={13} />
            Editor
          </button>
          {selectedCodeId && (
            <button
              type="button"
              onClick={() => setViewMode('retrieval')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                viewMode === 'retrieval'
                  ? 'bg-zinc-200 text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              <LayoutGrid size={13} />
              Retrieval
            </button>
          )}
          <div className="w-px h-4 bg-zinc-200 mx-1" />
          <button
            type="button"
            onClick={() => setShowBackups(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-md"
            title="View project backups"
          >
            <History size={13} />
            Backups
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-md"
          >
            <Download size={13} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-md"
          >
            <Download size={13} />
            JSON
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <CollapsibleSidebar
          side="left"
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed(!leftCollapsed)}
          title="Transcripts"
        >
          <LeftSidebar
            projectId={projectId}
            activeTranscriptId={activeTranscriptId}
            onSelectTranscript={(id) => {
              setActiveTranscriptId(id)
              setViewMode('editor')
            }}
            onOpenMemo={(memo, scope) =>
              setMemoEditor({ scope, memo, code: undefined })
            }
            onTranscriptDeleted={(deletedId, undoSnapshot) => {
              if (activeTranscriptId === deletedId) {
                setActiveTranscriptId(null)
              }
              if (undoSnapshot) {
                setUndoDelete({
                  snapshot: undoSnapshot,
                  message: `"${undoSnapshot.transcript.title}" deleted`,
                })
              }
              bump()
            }}
          />
        </CollapsibleSidebar>

        <main className="flex-1 flex flex-col min-w-0 bg-zinc-50/50">
          {viewMode === 'retrieval' && selectedCodeId ? (
            <RetrievalView
              projectId={projectId}
              codeId={selectedCodeId}
              onNavigateToTranscript={(transcriptId) => {
                setActiveTranscriptId(transcriptId)
                setViewMode('editor')
              }}
              onBack={() => {
                setViewMode('editor')
                setSelectedCodeId(null)
              }}
            />
          ) : activeTranscriptId ? (
            <TranscriptEditor
              transcriptId={activeTranscriptId}
              projectId={projectId}
              pendingCodeId={pendingCodeId}
              onPendingCodeConsumed={() => setPendingCodeId(null)}
              refreshKey={refreshKey}
              onDataChanged={bump}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
              Select or create a transcript to begin coding
            </div>
          )}
        </main>

        <CollapsibleSidebar
          side="right"
          collapsed={rightCollapsed}
          onToggle={() => setRightCollapsed(!rightCollapsed)}
          title="Codebook"
          width="w-72"
        >
          <RightSidebar
            projectId={projectId}
            selectedCodeId={selectedCodeId}
            onSelectCode={handleSelectCode}
            onAssignCode={handleAssignCode}
            onOpenCodeMemo={(code, memo) =>
              setMemoEditor({ scope: 'code', memo, code })
            }
            refreshKey={refreshKey}
            onDataChanged={bump}
            onCodeDeleted={(undoSnapshot) => {
              if (undoSnapshot) {
                setUndoCodeDelete({
                  snapshot: undoSnapshot,
                  message: `Code "${undoSnapshot.code.name}" deleted`,
                })
              }
              bump()
            }}
          />
        </CollapsibleSidebar>
      </div>

      {memoEditor && (
        <MemoEditor
          projectId={projectId}
          scope={memoEditor.scope}
          entityId={activeTranscriptId ?? undefined}
          code={memoEditor.code}
          existingMemo={memoEditor.memo}
          onClose={() => setMemoEditor(null)}
          onSaved={bump}
        />
      )}

      {showBackups && (
        <BackupsDialog
          projectId={projectId}
          onClose={() => setShowBackups(false)}
          onRestored={() => {
            setActiveTranscriptId(null)
            setSelectedCodeId(null)
            bump()
          }}
        />
      )}

      {undoDelete && (
        <UndoToast
          message={undoDelete.message}
          onUndo={handleUndoDelete}
          onDismiss={() => setUndoDelete(null)}
        />
      )}

      {undoCodeDelete && (
        <UndoToast
          message={undoCodeDelete.message}
          onUndo={handleUndoCodeDelete}
          onDismiss={() => setUndoCodeDelete(null)}
        />
      )}
    </div>
  )
}
