import type {
  Code,
  Highlight,
  HighlightCode,
  Memo,
  Project,
  Transcript,
} from './index'

export interface ProjectSnapshot {
  project: Project
  transcripts: Transcript[]
  codes: Code[]
  highlights: Highlight[]
  highlightCodes: HighlightCode[]
  memos: Memo[]
}

export type BackupReason = 'auto' | 'before_delete' | 'manual'

export interface ProjectBackup {
  id: string
  projectId: string
  label: string
  reason: BackupReason
  createdAt: number
  snapshot: ProjectSnapshot
}

export interface TranscriptDeleteSnapshot {
  transcript: Transcript
  highlights: Highlight[]
  highlightCodes: HighlightCode[]
  memos: Memo[]
}

export type CodebookBackupReason = 'auto' | 'before_delete' | 'before_edit' | 'manual'

export interface CodebookBackup {
  id: string
  projectId: string
  label: string
  reason: CodebookBackupReason
  createdAt: number
  codes: Code[]
}

export interface CodeDeleteSnapshot {
  code: Code
  highlightCodes: HighlightCode[]
  memos: Memo[]
}
