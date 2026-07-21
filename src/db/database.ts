import Dexie, { type Table } from 'dexie'
import type {
  Code,
  Highlight,
  HighlightCode,
  Memo,
  Project,
  Transcript,
} from '../types'
import type { ProjectBackup, CodebookBackup } from '../types/backup'

export class QDADatabase extends Dexie {
  projects!: Table<Project, string>
  transcripts!: Table<Transcript, string>
  codes!: Table<Code, string>
  highlights!: Table<Highlight, string>
  highlightCodes!: Table<HighlightCode, string>
  memos!: Table<Memo, string>
  projectBackups!: Table<ProjectBackup, string>
  codebookBackups!: Table<CodebookBackup, string>

  constructor() {
    super('ReflexiveQDA')

    this.version(1).stores({
      projects: 'id, title, updatedAt, createdAt',
      transcripts: 'id, projectId, [projectId+sortOrder], updatedAt',
      codes: 'id, projectId, parentId, [projectId+parentId], [projectId+name]',
      highlights: 'id, transcriptId, [transcriptId+startOffset]',
      highlightCodes: 'id, highlightId, codeId, [highlightId+codeId]',
      memos:
        'id, projectId, scope, [projectId+scope], transcriptId, codeId, [codeId+projectId], updatedAt',
    })

    this.version(2).stores({
      projects: 'id, title, updatedAt, createdAt',
      transcripts: 'id, projectId, [projectId+sortOrder], updatedAt',
      codes: 'id, projectId, parentId, [projectId+parentId], [projectId+name]',
      highlights: 'id, transcriptId, [transcriptId+startOffset]',
      highlightCodes: 'id, highlightId, codeId, [highlightId+codeId]',
      memos:
        'id, projectId, scope, [projectId+scope], transcriptId, codeId, [codeId+projectId], updatedAt',
      projectBackups: 'id, projectId, createdAt, [projectId+createdAt]',
    })

    this.version(3).stores({
      projects: 'id, title, updatedAt, createdAt',
      transcripts: 'id, projectId, [projectId+sortOrder], updatedAt',
      codes: 'id, projectId, parentId, [projectId+parentId], [projectId+name]',
      highlights: 'id, transcriptId, [transcriptId+startOffset]',
      highlightCodes: 'id, highlightId, codeId, [highlightId+codeId]',
      memos:
        'id, projectId, scope, [projectId+scope], transcriptId, codeId, [codeId+projectId], updatedAt',
      projectBackups: 'id, projectId, createdAt, [projectId+createdAt]',
      codebookBackups: 'id, projectId, createdAt, [projectId+createdAt]',
    })
  }
}

export const db = new QDADatabase()
