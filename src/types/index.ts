export type MemoScope = 'project' | 'transcript' | 'code'

export interface Project {
  id: string
  title: string
  description?: string
  createdAt: number
  updatedAt: number
}

export interface Transcript {
  id: string
  projectId: string
  title: string
  content: string
  plainText: string
  sortOrder: number
  colorIndex: number
  createdAt: number
  updatedAt: number
}

export interface Code {
  id: string
  projectId: string
  parentId: string | null
  name: string
  description?: string
  sortOrder: number
  color?: string
  createdAt: number
}

export interface Highlight {
  id: string
  transcriptId: string
  startOffset: number
  endOffset: number
  excerpt: string
  createdAt: number
}

export interface HighlightCode {
  id: string
  highlightId: string
  codeId: string
  createdAt: number
}

export interface Memo {
  id: string
  projectId: string
  scope: MemoScope
  transcriptId?: string
  codeId?: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface CodeWithCount extends Code {
  count: number
  children: CodeWithCount[]
}

export interface RetrievalItem {
  highlightId: string
  excerpt: string
  transcriptId: string
  transcriptTitle: string
  startOffset: number
  codedAt: number
}

export interface ExportRow {
  participant: string
  transcriptName: string
  excerpt: string
  codeName: string
  codeMemo: string
  codedAt: string
}

export type ViewMode = 'editor' | 'retrieval'

export type { ProjectBackup, ProjectSnapshot, TranscriptDeleteSnapshot, BackupReason, CodebookBackup, CodebookBackupReason, CodeDeleteSnapshot } from './backup'
