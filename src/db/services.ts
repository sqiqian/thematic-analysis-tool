import { db } from './database'
import type {
  Code,
  CodeWithCount,
  ExportRow,
  Highlight,
  HighlightCode,
  Memo,
  MemoScope,
  Project,
  RetrievalItem,
  Transcript,
} from '../types'
import { generateId } from '../utils/id'
import { planHighlightRemap } from '../utils/highlightRemap'
import { htmlToPlainText } from '../utils/plainText'

// ─── Projects ───────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function createProject(title: string, description?: string): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: generateId(),
    title,
    description,
    createdAt: now,
    updatedAt: now,
  }
  await db.projects.add(project)
  return project
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'title' | 'description'>>,
): Promise<void> {
  await db.projects.update(id, { ...updates, updatedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.transcripts, db.codes, db.highlights, db.highlightCodes, db.memos],
    async () => {
      const transcripts = await db.transcripts.where('projectId').equals(id).toArray()
      const transcriptIds = transcripts.map((t) => t.id)

      if (transcriptIds.length > 0) {
        const highlights = await db.highlights
          .where('transcriptId')
          .anyOf(transcriptIds)
          .toArray()
        const highlightIds = highlights.map((h) => h.id)
        if (highlightIds.length > 0) {
          await db.highlightCodes.where('highlightId').anyOf(highlightIds).delete()
          await db.highlights.bulkDelete(highlightIds)
        }
      }

      await db.memos.where('projectId').equals(id).delete()
      await db.codes.where('projectId').equals(id).delete()
      await db.transcripts.where('projectId').equals(id).delete()
      await db.projects.delete(id)
    },
  )
}

export async function touchProject(projectId: string): Promise<void> {
  await db.projects.update(projectId, { updatedAt: Date.now() })
}

// ─── Transcripts ────────────────────────────────────────────

export async function listTranscripts(projectId: string): Promise<Transcript[]> {
  return db.transcripts.where('[projectId+sortOrder]').between([projectId, 0], [projectId, Infinity]).toArray()
}

export async function getTranscript(id: string): Promise<Transcript | undefined> {
  return db.transcripts.get(id)
}

export async function createTranscript(projectId: string, title: string): Promise<Transcript> {
  const existing = await listTranscripts(projectId)
  const maxColorIndex = existing.reduce(
    (max, t) => Math.max(max, t.colorIndex ?? t.sortOrder ?? 0),
    -1,
  )
  const now = Date.now()
  const transcript: Transcript = {
    id: generateId(),
    projectId,
    title,
    content: '<p></p>',
    plainText: '',
    sortOrder: existing.length,
    colorIndex: maxColorIndex + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.transcripts.add(transcript)
  await touchProject(projectId)
  return transcript
}

export async function updateTranscript(
  id: string,
  updates: Partial<Pick<Transcript, 'title' | 'content' | 'plainText'>>,
): Promise<void> {
  const transcript = await db.transcripts.get(id)
  if (!transcript) return

  const content = updates.content ?? transcript.content
  const plainText = updates.plainText ?? htmlToPlainText(content)
  const oldPlainText = transcript.plainText

  if (updates.plainText !== undefined || updates.content !== undefined) {
    if (plainText !== oldPlainText) {
      await remapHighlightsForTranscript(id, oldPlainText, plainText)
    }
  }

  await db.transcripts.update(id, {
    ...updates,
    content,
    plainText,
    updatedAt: Date.now(),
  })
  await touchProject(transcript.projectId)
}

export async function getTranscriptCodingStats(transcriptId: string): Promise<{
  highlightCount: number
  codingCount: number
}> {
  const highlights = await listHighlights(transcriptId)
  if (highlights.length === 0) {
    return { highlightCount: 0, codingCount: 0 }
  }
  const codingCount = await db.highlightCodes
    .where('highlightId')
    .anyOf(highlights.map((h) => h.id))
    .count()
  return { highlightCount: highlights.length, codingCount }
}

async function remapHighlightsForTranscript(
  transcriptId: string,
  oldPlainText: string,
  newPlainText: string,
): Promise<void> {
  const highlights = await listHighlights(transcriptId)
  if (highlights.length === 0) return

  const { updates, removeIds } = planHighlightRemap(highlights, oldPlainText, newPlainText)

  await db.transaction('rw', [db.highlights, db.highlightCodes], async () => {
    for (const u of updates) {
      await db.highlights.update(u.id, {
        startOffset: u.startOffset,
        endOffset: u.endOffset,
        excerpt: u.excerpt,
      })
    }
    if (removeIds.length > 0) {
      await db.highlightCodes.where('highlightId').anyOf(removeIds).delete()
      await db.highlights.bulkDelete(removeIds)
    }
  })
}

export async function deleteTranscript(id: string): Promise<void> {
  const transcript = await db.transcripts.get(id)
  if (!transcript) return

  await db.transaction('rw', [db.transcripts, db.highlights, db.highlightCodes, db.memos], async () => {
    const highlights = await db.highlights.where('transcriptId').equals(id).toArray()
    const highlightIds = highlights.map((h) => h.id)
    if (highlightIds.length > 0) {
      await db.highlightCodes.where('highlightId').anyOf(highlightIds).delete()
      await db.highlights.bulkDelete(highlightIds)
    }
    await db.memos.where('transcriptId').equals(id).delete()
    await db.transcripts.delete(id)
  })
  await touchProject(transcript.projectId)
}

// ─── Codes ──────────────────────────────────────────────────

export async function listCodes(projectId: string): Promise<Code[]> {
  return db.codes.where('projectId').equals(projectId).toArray()
}

export async function createCode(
  projectId: string,
  name: string,
  parentId: string | null = null,
): Promise<Code> {
  const siblings = (await listCodes(projectId)).filter((c) => c.parentId === parentId)
  const code: Code = {
    id: generateId(),
    projectId,
    parentId,
    name,
    sortOrder: siblings.length,
    createdAt: Date.now(),
  }
  await db.codes.add(code)
  await touchProject(projectId)
  return code
}

export async function updateCode(
  id: string,
  updates: Partial<Pick<Code, 'name' | 'description' | 'color' | 'parentId' | 'sortOrder'>>,
): Promise<void> {
  const code = await db.codes.get(id)
  if (!code) return
  await db.codes.update(id, updates)
  await touchProject(code.projectId)
}

export async function deleteCode(id: string): Promise<{ ok: boolean; error?: string }> {
  const code = await db.codes.get(id)
  if (!code) return { ok: false, error: 'Code not found' }

  const children = await db.codes.where('parentId').equals(id).count()
  if (children > 0) {
    return { ok: false, error: 'Cannot delete a code that has child codes. Remove or reassign children first.' }
  }

  await db.transaction('rw', [db.codes, db.highlightCodes, db.memos], async () => {
    await db.highlightCodes.where('codeId').equals(id).delete()
    await db.memos.where('codeId').equals(id).delete()
    await db.codes.delete(id)
  })
  await touchProject(code.projectId)
  return { ok: true }
}

async function getTranscriptIdsForProject(projectId: string): Promise<Set<string>> {
  const transcripts = await db.transcripts.where('projectId').equals(projectId).toArray()
  return new Set(transcripts.map((t) => t.id))
}

export async function getCodeFrequency(codeId: string, projectId: string): Promise<number> {
  const transcriptIds = await getTranscriptIdsForProject(projectId)
  const links = await db.highlightCodes.where('codeId').equals(codeId).toArray()
  if (links.length === 0) return 0

  const highlights = (await db.highlights.bulkGet(links.map((l) => l.highlightId))).filter(
    Boolean,
  ) as Highlight[]
  return highlights.filter((h) => transcriptIds.has(h.transcriptId)).length
}

export async function buildCodeTree(projectId: string): Promise<CodeWithCount[]> {
  const codes = await listCodes(projectId)
  const counts = await Promise.all(codes.map((c) => getCodeFrequency(c.id, projectId)))
  const countMap = Object.fromEntries(codes.map((c, i) => [c.id, counts[i]]))

  function build(parentId: string | null): CodeWithCount[] {
    return codes
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => {
        const children = build(c.id)
        const childTotal = children.reduce((sum, ch) => sum + ch.count, 0)
        return {
          ...c,
          count: countMap[c.id] + childTotal,
          children,
        }
      })
  }

  return build(null)
}

export function flattenCodeTree(tree: CodeWithCount[]): CodeWithCount[] {
  const result: CodeWithCount[] = []
  function walk(nodes: CodeWithCount[]) {
    for (const node of nodes) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(tree)
  return result
}

export function getCodePath(code: Code, allCodes: Code[]): string {
  const parts: string[] = [code.name]
  let current = code
  while (current.parentId) {
    const parent = allCodes.find((c) => c.id === current.parentId)
    if (!parent) break
    parts.unshift(parent.name)
    current = parent
  }
  return parts.join(' › ')
}

function isDescendantOf(
  potentialDescendantId: string,
  ancestorId: string,
  codes: Code[],
): boolean {
  let current = codes.find((c) => c.id === potentialDescendantId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = codes.find((c) => c.id === current!.parentId)
  }
  return false
}

export async function moveCode(
  codeId: string,
  newParentId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const code = await db.codes.get(codeId)
  if (!code) return { ok: false, error: 'Code not found' }

  if (newParentId === codeId) {
    return { ok: false, error: 'A code cannot be nested inside itself.' }
  }

  const codes = await listCodes(code.projectId)

  if (newParentId) {
    const parent = codes.find((c) => c.id === newParentId)
    if (!parent) return { ok: false, error: 'Parent code not found' }
    if (isDescendantOf(newParentId, codeId, codes)) {
      return { ok: false, error: 'A code cannot be nested inside its own descendant.' }
    }
  }

  const siblings = codes.filter((c) => c.parentId === newParentId && c.id !== codeId)
  await updateCode(codeId, { parentId: newParentId, sortOrder: siblings.length })
  return { ok: true }
}

// ─── Highlights ─────────────────────────────────────────────

export async function listHighlights(transcriptId: string): Promise<Highlight[]> {
  return db.highlights.where('transcriptId').equals(transcriptId).toArray()
}

export async function listHighlightCodes(highlightId: string): Promise<HighlightCode[]> {
  return db.highlightCodes.where('highlightId').equals(highlightId).toArray()
}

export async function listHighlightCodesForTranscript(transcriptId: string): Promise<HighlightCode[]> {
  const highlights = await listHighlights(transcriptId)
  if (highlights.length === 0) return []
  return db.highlightCodes.where('highlightId').anyOf(highlights.map((h) => h.id)).toArray()
}

export async function findHighlightAtRange(
  transcriptId: string,
  startOffset: number,
  endOffset: number,
): Promise<Highlight | undefined> {
  const highlights = await listHighlights(transcriptId)
  return highlights.find((h) => h.startOffset === startOffset && h.endOffset === endOffset)
}

export async function createHighlight(
  transcriptId: string,
  startOffset: number,
  endOffset: number,
  excerpt: string,
  codeId: string,
): Promise<Highlight> {
  const transcript = await db.transcripts.get(transcriptId)
  if (!transcript) throw new Error('Transcript not found')

  const highlight = await db.transaction('rw', [db.highlights, db.highlightCodes], async () => {
    let h = await findHighlightAtRange(transcriptId, startOffset, endOffset)

    if (!h) {
      h = {
        id: generateId(),
        transcriptId,
        startOffset,
        endOffset,
        excerpt,
        createdAt: Date.now(),
      }
      await db.highlights.add(h)
    }

    const existing = await db.highlightCodes
      .where('[highlightId+codeId]')
      .equals([h.id, codeId])
      .first()

    if (!existing) {
      await db.highlightCodes.add({
        id: generateId(),
        highlightId: h.id,
        codeId,
        createdAt: Date.now(),
      })
    }

    return h
  })

  await touchProject(transcript.projectId)
  return highlight
}

export async function addCodeToHighlight(highlightId: string, codeId: string): Promise<void> {
  const highlight = await db.highlights.get(highlightId)
  if (!highlight) return

  const existing = await db.highlightCodes
    .where('[highlightId+codeId]')
    .equals([highlightId, codeId])
    .first()

  if (!existing) {
    await db.highlightCodes.add({
      id: generateId(),
      highlightId,
      codeId,
      createdAt: Date.now(),
    })
    const transcript = await db.transcripts.get(highlight.transcriptId)
    if (transcript) await touchProject(transcript.projectId)
  }
}

export async function removeCodeFromHighlight(highlightId: string, codeId: string): Promise<void> {
  const highlight = await db.highlights.get(highlightId)
  if (!highlight) return

  await db.transaction('rw', [db.highlightCodes, db.highlights], async () => {
    await db.highlightCodes.where('[highlightId+codeId]').equals([highlightId, codeId]).delete()
    const remaining = await db.highlightCodes.where('highlightId').equals(highlightId).count()
    if (remaining === 0) {
      await db.highlights.delete(highlightId)
    }
  })

  const transcript = await db.transcripts.get(highlight.transcriptId)
  if (transcript) await touchProject(transcript.projectId)
}

export async function getHighlightsWithCodes(transcriptId: string) {
  const highlights = await listHighlights(transcriptId)
  const allLinks = await listHighlightCodesForTranscript(transcriptId)
  const codeIds = [...new Set(allLinks.map((l) => l.codeId))]
  const codes = (await db.codes.bulkGet(codeIds)).filter(Boolean) as Code[]

  return highlights.map((h) => ({
    highlight: h,
    codes: allLinks
      .filter((l) => l.highlightId === h.id)
      .map((l) => codes.find((c) => c.id === l.codeId))
      .filter(Boolean) as Code[],
  }))
}

// ─── Retrieval ────────────────────────────────────────────────

export async function getExcerptsForCode(codeId: string, projectId: string): Promise<RetrievalItem[]> {
  const code = await db.codes.get(codeId)
  if (!code || code.projectId !== projectId) return []

  const transcriptIds = await getTranscriptIdsForProject(projectId)
  const links = await db.highlightCodes.where('codeId').equals(codeId).toArray()
  if (links.length === 0) return []

  const highlights = (await db.highlights.bulkGet(links.map((l) => l.highlightId))).filter(
    Boolean,
  ) as Highlight[]
  const relevantHighlights = highlights.filter((h) => transcriptIds.has(h.transcriptId))
  const transcriptMap = Object.fromEntries(
    (await db.transcripts.bulkGet([...new Set(relevantHighlights.map((h) => h.transcriptId))]))
      .filter(Boolean)
      .map((t) => [t!.id, t!]),
  )

  return links
    .map((link) => {
      const h = relevantHighlights.find((x) => x.id === link.highlightId)
      if (!h) return null
      const transcript = transcriptMap[h.transcriptId]
      if (!transcript) return null
      return {
        highlightId: h.id,
        excerpt: h.excerpt,
        transcriptId: h.transcriptId,
        transcriptTitle: transcript.title,
        startOffset: h.startOffset,
        codedAt: link.createdAt,
      }
    })
    .filter(Boolean) as RetrievalItem[]
}

// ─── Memos ──────────────────────────────────────────────────

export async function listMemos(
  projectId: string,
  scope?: MemoScope,
  entityId?: string,
): Promise<Memo[]> {
  let collection = db.memos.where('projectId').equals(projectId)
  const memos = await collection.toArray()

  return memos
    .filter((m) => {
      if (scope && m.scope !== scope) return false
      if (scope === 'transcript' && entityId && m.transcriptId !== entityId) return false
      if (scope === 'code' && entityId && m.codeId !== entityId) return false
      return true
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function createMemo(
  projectId: string,
  scope: MemoScope,
  title: string,
  content: string,
  entityId?: string,
): Promise<Memo> {
  const now = Date.now()
  const memo: Memo = {
    id: generateId(),
    projectId,
    scope,
    title,
    content,
    createdAt: now,
    updatedAt: now,
  }

  if (scope === 'transcript') memo.transcriptId = entityId
  if (scope === 'code') memo.codeId = entityId

  await db.memos.add(memo)
  await touchProject(projectId)
  return memo
}

export async function updateMemo(
  id: string,
  updates: Partial<Pick<Memo, 'title' | 'content'>>,
): Promise<void> {
  const memo = await db.memos.get(id)
  if (!memo) return
  await db.memos.update(id, { ...updates, updatedAt: Date.now() })
  await touchProject(memo.projectId)
}

export async function deleteMemo(id: string): Promise<void> {
  const memo = await db.memos.get(id)
  if (!memo) return
  await db.memos.delete(id)
  await touchProject(memo.projectId)
}

export async function getCodeMemosText(codeId: string): Promise<string> {
  const memos = await db.memos.where('codeId').equals(codeId).toArray()
  return memos
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => `${m.title}\n${m.content}`)
    .join('\n\n---\n\n')
}

// ─── Export ─────────────────────────────────────────────────

export async function buildExportRows(projectId: string): Promise<ExportRow[]> {
  const transcripts = await listTranscripts(projectId)
  const codes = await listCodes(projectId)
  const rows: ExportRow[] = []

  for (const transcript of transcripts) {
    const highlights = await listHighlights(transcript.id)
    for (const highlight of highlights) {
      const links = await listHighlightCodes(highlight.id)
      for (const link of links) {
        const code = codes.find((c) => c.id === link.codeId)
        if (!code) continue
        const codeMemo = await getCodeMemosText(code.id)
        rows.push({
          participant: transcript.title,
          transcriptName: transcript.title,
          excerpt: highlight.excerpt,
          codeName: getCodePath(code, codes),
          codeMemo,
          codedAt: new Date(link.createdAt).toISOString(),
        })
      }
    }
  }

  return rows.sort(
    (a, b) =>
      a.participant.localeCompare(b.participant) || a.codeName.localeCompare(b.codeName),
  )
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, filename)
}

export function downloadCSV(rows: ExportRow[], filename: string): void {
  const headers = ['participant', 'transcriptName', 'excerpt', 'codeName', 'codeMemo', 'codedAt']
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h as keyof ExportRow])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
