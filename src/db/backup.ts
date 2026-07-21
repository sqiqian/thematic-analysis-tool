import { db } from './database'
import { deleteCode, deleteTranscript } from './services'
import type {
  BackupReason,
  CodebookBackup,
  CodebookBackupReason,
  CodeDeleteSnapshot,
  ProjectBackup,
  ProjectSnapshot,
  TranscriptDeleteSnapshot,
} from '../types/backup'
import { generateId } from '../utils/id'

const MAX_BACKUPS_PER_PROJECT = 30
const AUTO_BACKUP_INTERVAL_MS = 3 * 60 * 1000
const AUTO_CODEBOOK_BACKUP_INTERVAL_MS = 2 * 60 * 1000

const lastAutoBackupAt = new Map<string, number>()
const lastCodebookBackupAt = new Map<string, number>()

export async function captureProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  const project = await db.projects.get(projectId)
  if (!project) return null

  const transcripts = await db.transcripts.where('projectId').equals(projectId).toArray()
  const transcriptIds = transcripts.map((t) => t.id)

  const highlights =
    transcriptIds.length > 0
      ? await db.highlights.where('transcriptId').anyOf(transcriptIds).toArray()
      : []

  const highlightIds = highlights.map((h) => h.id)
  const highlightCodes =
    highlightIds.length > 0
      ? await db.highlightCodes.where('highlightId').anyOf(highlightIds).toArray()
      : []

  const codes = await db.codes.where('projectId').equals(projectId).toArray()
  const memos = await db.memos.where('projectId').equals(projectId).toArray()

  return {
    project: { ...project },
    transcripts: transcripts.map((t) => ({ ...t })),
    codes: codes.map((c) => ({ ...c })),
    highlights: highlights.map((h) => ({ ...h })),
    highlightCodes: highlightCodes.map((l) => ({ ...l })),
    memos: memos.map((m) => ({ ...m })),
  }
}

export async function captureTranscriptDeleteSnapshot(
  transcriptId: string,
): Promise<TranscriptDeleteSnapshot | null> {
  const transcript = await db.transcripts.get(transcriptId)
  if (!transcript) return null

  const highlights = await db.highlights.where('transcriptId').equals(transcriptId).toArray()
  const highlightIds = highlights.map((h) => h.id)
  const highlightCodes =
    highlightIds.length > 0
      ? await db.highlightCodes.where('highlightId').anyOf(highlightIds).toArray()
      : []
  const memos = await db.memos.where('transcriptId').equals(transcriptId).toArray()

  return {
    transcript: { ...transcript },
    highlights: highlights.map((h) => ({ ...h })),
    highlightCodes: highlightCodes.map((l) => ({ ...l })),
    memos: memos.map((m) => ({ ...m })),
  }
}

async function pruneBackups(projectId: string): Promise<void> {
  const backups = await db.projectBackups
    .where('[projectId+createdAt]')
    .between([projectId, 0], [projectId, Infinity])
    .reverse()
    .toArray()

  if (backups.length <= MAX_BACKUPS_PER_PROJECT) return

  const toDelete = backups.slice(MAX_BACKUPS_PER_PROJECT)
  await db.projectBackups.bulkDelete(toDelete.map((b) => b.id))
}

export async function createProjectBackup(
  projectId: string,
  label: string,
  reason: BackupReason,
): Promise<ProjectBackup | null> {
  const snapshot = await captureProjectSnapshot(projectId)
  if (!snapshot) return null

  const backup: ProjectBackup = {
    id: generateId(),
    projectId,
    label,
    reason,
    createdAt: Date.now(),
    snapshot,
  }

  await db.projectBackups.add(backup)
  await pruneBackups(projectId)
  return backup
}

export async function maybeAutoBackup(
  projectId: string,
  transcriptTitle: string,
): Promise<void> {
  const now = Date.now()
  const last = lastAutoBackupAt.get(projectId) ?? 0
  if (now - last < AUTO_BACKUP_INTERVAL_MS) return

  await createProjectBackup(projectId, `Auto-save: ${transcriptTitle}`, 'auto')
  lastAutoBackupAt.set(projectId, now)
}

export async function listProjectBackups(projectId: string): Promise<ProjectBackup[]> {
  return db.projectBackups
    .where('[projectId+createdAt]')
    .between([projectId, 0], [projectId, Infinity])
    .reverse()
    .toArray()
}

export async function restoreProjectBackup(backupId: string): Promise<{ ok: boolean; error?: string }> {
  const backup = await db.projectBackups.get(backupId)
  if (!backup) return { ok: false, error: 'Backup not found' }

  const { snapshot } = backup
  const projectId = snapshot.project.id

  await db.transaction(
    'rw',
    [
      db.projects,
      db.transcripts,
      db.codes,
      db.highlights,
      db.highlightCodes,
      db.memos,
    ],
    async () => {
      const existingTranscripts = await db.transcripts.where('projectId').equals(projectId).toArray()
      const existingTranscriptIds = existingTranscripts.map((t) => t.id)

      if (existingTranscriptIds.length > 0) {
        const existingHighlights = await db.highlights
          .where('transcriptId')
          .anyOf(existingTranscriptIds)
          .toArray()
        const existingHighlightIds = existingHighlights.map((h) => h.id)
        if (existingHighlightIds.length > 0) {
          await db.highlightCodes.where('highlightId').anyOf(existingHighlightIds).delete()
          await db.highlights.bulkDelete(existingHighlightIds)
        }
      }

      await db.memos.where('projectId').equals(projectId).delete()
      await db.codes.where('projectId').equals(projectId).delete()
      await db.transcripts.where('projectId').equals(projectId).delete()

      await db.projects.put(snapshot.project)
      if (snapshot.transcripts.length) await db.transcripts.bulkPut(snapshot.transcripts)
      if (snapshot.codes.length) await db.codes.bulkPut(snapshot.codes)
      if (snapshot.highlights.length) await db.highlights.bulkPut(snapshot.highlights)
      if (snapshot.highlightCodes.length) await db.highlightCodes.bulkPut(snapshot.highlightCodes)
      if (snapshot.memos.length) await db.memos.bulkPut(snapshot.memos)

      await db.projects.update(projectId, { updatedAt: Date.now() })
    },
  )

  return { ok: true }
}

export async function restoreTranscriptDelete(
  snapshot: TranscriptDeleteSnapshot,
): Promise<void> {
  const { transcript, highlights, highlightCodes, memos } = snapshot

  await db.transaction(
    'rw',
    [db.transcripts, db.highlights, db.highlightCodes, db.memos, db.projects],
    async () => {
      const existing = await db.transcripts.get(transcript.id)
      if (!existing) {
        await db.transcripts.add(transcript)
      } else {
        await db.transcripts.put(transcript)
      }

      if (highlights.length) await db.highlights.bulkPut(highlights)
      if (highlightCodes.length) await db.highlightCodes.bulkPut(highlightCodes)
      if (memos.length) await db.memos.bulkPut(memos)

      await db.projects.update(transcript.projectId, { updatedAt: Date.now() })
    },
  )
}

export function formatBackupTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function reasonLabel(reason: BackupReason): string {
  switch (reason) {
    case 'auto':
      return 'Auto-save'
    case 'before_delete':
      return 'Before delete'
    case 'manual':
      return 'Manual'
  }
}

export async function deleteTranscriptWithBackup(
  transcriptId: string,
): Promise<TranscriptDeleteSnapshot | null> {
  const snapshot = await captureTranscriptDeleteSnapshot(transcriptId)
  if (!snapshot) return null

  await createProjectBackup(
    snapshot.transcript.projectId,
    `Before delete: ${snapshot.transcript.title}`,
    'before_delete',
  )

  await deleteTranscript(transcriptId)
  return snapshot
}

// ─── Codebook backups ───────────────────────────────────────

async function pruneCodebookBackups(projectId: string): Promise<void> {
  const backups = await db.codebookBackups
    .where('[projectId+createdAt]')
    .between([projectId, 0], [projectId, Infinity])
    .reverse()
    .toArray()

  if (backups.length <= MAX_BACKUPS_PER_PROJECT) return

  const toDelete = backups.slice(MAX_BACKUPS_PER_PROJECT)
  await db.codebookBackups.bulkDelete(toDelete.map((b) => b.id))
}

export async function captureCodebookSnapshot(projectId: string) {
  const codes = await db.codes.where('projectId').equals(projectId).toArray()
  return codes.map((c) => ({ ...c }))
}

export async function createCodebookBackup(
  projectId: string,
  label: string,
  reason: CodebookBackupReason,
): Promise<CodebookBackup | null> {
  const codes = await captureCodebookSnapshot(projectId)

  const backup: CodebookBackup = {
    id: generateId(),
    projectId,
    label,
    reason,
    createdAt: Date.now(),
    codes,
  }

  await db.codebookBackups.add(backup)
  await pruneCodebookBackups(projectId)
  return backup
}

export async function maybeAutoCodebookBackup(projectId: string): Promise<void> {
  const now = Date.now()
  const last = lastCodebookBackupAt.get(projectId) ?? 0
  if (now - last < AUTO_CODEBOOK_BACKUP_INTERVAL_MS) return

  const count = await db.codes.where('projectId').equals(projectId).count()
  if (count === 0) return

  await createCodebookBackup(projectId, 'Auto-save: codebook', 'auto')
  lastCodebookBackupAt.set(projectId, now)
}

export async function listCodebookBackups(projectId: string): Promise<CodebookBackup[]> {
  return db.codebookBackups
    .where('[projectId+createdAt]')
    .between([projectId, 0], [projectId, Infinity])
    .reverse()
    .toArray()
}

async function cleanupOrphanCodeLinks(projectId: string, validCodeIds: Set<string>): Promise<void> {
  const transcripts = await db.transcripts.where('projectId').equals(projectId).toArray()
  const transcriptIds = transcripts.map((t) => t.id)
  if (transcriptIds.length === 0) return

  const highlights = await db.highlights.where('transcriptId').anyOf(transcriptIds).toArray()
  const highlightIds = highlights.map((h) => h.id)
  if (highlightIds.length === 0) return

  const links = await db.highlightCodes.where('highlightId').anyOf(highlightIds).toArray()
  const orphanLinkIds = links.filter((l) => !validCodeIds.has(l.codeId)).map((l) => l.id)
  if (orphanLinkIds.length > 0) {
    await db.highlightCodes.bulkDelete(orphanLinkIds)
  }

  for (const highlight of highlights) {
    const remaining = await db.highlightCodes.where('highlightId').equals(highlight.id).count()
    if (remaining === 0) {
      await db.highlights.delete(highlight.id)
    }
  }
}

export async function restoreCodebookBackup(
  backupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const backup = await db.codebookBackups.get(backupId)
  if (!backup) return { ok: false, error: 'Backup not found' }

  const { projectId, codes } = backup
  const validCodeIds = new Set(codes.map((c) => c.id))

  await db.transaction(
    'rw',
    [db.codes, db.highlightCodes, db.highlights, db.memos, db.projects],
    async () => {
      const currentCodes = await db.codes.where('projectId').equals(projectId).toArray()
      const removedCodeIds = currentCodes
        .filter((c) => !validCodeIds.has(c.id))
        .map((c) => c.id)

      if (removedCodeIds.length > 0) {
        await db.highlightCodes.where('codeId').anyOf(removedCodeIds).delete()
        await db.memos.where('codeId').anyOf(removedCodeIds).delete()
      }

      await db.codes.where('projectId').equals(projectId).delete()
      if (codes.length) await db.codes.bulkPut(codes)

      await cleanupOrphanCodeLinks(projectId, validCodeIds)
      await db.projects.update(projectId, { updatedAt: Date.now() })
    },
  )

  return { ok: true }
}

export async function captureCodeDeleteSnapshot(
  codeId: string,
): Promise<CodeDeleteSnapshot | null> {
  const code = await db.codes.get(codeId)
  if (!code) return null

  const highlightCodes = await db.highlightCodes.where('codeId').equals(codeId).toArray()
  const memos = await db.memos.where('codeId').equals(codeId).toArray()

  return {
    code: { ...code },
    highlightCodes: highlightCodes.map((l) => ({ ...l })),
    memos: memos.map((m) => ({ ...m })),
  }
}

export async function restoreCodeDelete(snapshot: CodeDeleteSnapshot): Promise<void> {
  const { code, highlightCodes, memos } = snapshot

  await db.transaction(
    'rw',
    [db.codes, db.highlightCodes, db.memos, db.projects],
    async () => {
      const existing = await db.codes.get(code.id)
      if (!existing) {
        await db.codes.add(code)
      } else {
        await db.codes.put(code)
      }
      if (highlightCodes.length) await db.highlightCodes.bulkPut(highlightCodes)
      if (memos.length) await db.memos.bulkPut(memos)
      await db.projects.update(code.projectId, { updatedAt: Date.now() })
    },
  )
}

export function codebookReasonLabel(reason: CodebookBackupReason): string {
  switch (reason) {
    case 'auto':
      return 'Auto-save'
    case 'before_delete':
      return 'Before delete'
    case 'before_edit':
      return 'Before edit'
    case 'manual':
      return 'Manual'
  }
}

export async function deleteCodeWithBackup(
  codeId: string,
): Promise<{ ok: boolean; error?: string; undoSnapshot?: CodeDeleteSnapshot }> {
  const snapshot = await captureCodeDeleteSnapshot(codeId)
  if (!snapshot) return { ok: false, error: 'Code not found' }

  const children = await db.codes.where('parentId').equals(codeId).count()
  if (children > 0) {
    return {
      ok: false,
      error: 'Cannot delete a code that has child codes. Remove or reassign children first.',
    }
  }

  await createCodebookBackup(
    snapshot.code.projectId,
    `Before delete: ${snapshot.code.name}`,
    'before_delete',
  )

  const result = await deleteCode(codeId)
  if (!result.ok) return result

  return { ok: true, undoSnapshot: snapshot }
}
