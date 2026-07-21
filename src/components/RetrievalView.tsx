import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, User } from 'lucide-react'
import { getExcerptsForCode, getCodePath, listCodes, listTranscripts } from '../db/services'
import type { Code, RetrievalItem, Transcript } from '../types'
import { getTranscriptColor } from '../utils/transcriptColors'

interface RetrievalViewProps {
  projectId: string
  codeId: string
  onNavigateToTranscript: (transcriptId: string, startOffset: number) => void
  onBack: () => void
}

interface ParticipantGroup {
  transcriptId: string
  transcriptTitle: string
  items: RetrievalItem[]
}

export function RetrievalView({
  projectId,
  codeId,
  onNavigateToTranscript,
  onBack,
}: RetrievalViewProps) {
  const [code, setCode] = useState<Code | null>(null)
  const [allCodes, setAllCodes] = useState<Code[]>([])
  const [items, setItems] = useState<RetrievalItem[]>([])
  const [transcriptMap, setTranscriptMap] = useState<Map<string, Transcript>>(new Map())

  useEffect(() => {
    async function load() {
      const codes = await listCodes(projectId)
      const transcripts = await listTranscripts(projectId)
      setAllCodes(codes)
      setCode(codes.find((x) => x.id === codeId) ?? null)
      setItems(await getExcerptsForCode(codeId, projectId))
      setTranscriptMap(new Map(transcripts.map((t) => [t.id, t])))
    }
    load()
  }, [projectId, codeId])

  const colorForTranscript = (transcriptId: string) => {
    const t = transcriptMap.get(transcriptId)
    return getTranscriptColor(t ?? { colorIndex: 0 })
  }

  const groups = useMemo(() => {
    const map = new Map<string, ParticipantGroup>()
    for (const item of items) {
      const existing = map.get(item.transcriptId)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(item.transcriptId, {
          transcriptId: item.transcriptId,
          transcriptTitle: item.transcriptTitle,
          items: [item],
        })
      }
    }
    return [...map.values()]
  }, [items])

  const participantCount = groups.length

  if (!code) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-md"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-medium text-zinc-900">{getCodePath(code, allCodes)}</h2>
            <p className="text-xs text-zinc-400">
              {items.length} quote{items.length !== 1 ? 's' : ''} from {participantCount} participant
              {participantCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-9">
            {groups.map((g) => {
              const color = colorForTranscript(g.transcriptId)
              return (
                <span
                  key={g.transcriptId}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-full border"
                  style={{
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color.border }}
                  />
                  {g.transcriptTitle} ({g.items.length})
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[65ch] mx-auto px-6 py-6 space-y-8">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">
              No excerpts coded with this theme yet.
            </p>
          ) : (
            groups.map((group) => {
              const color = colorForTranscript(group.transcriptId)
              return (
                <section key={group.transcriptId}>
                  <div
                    className="flex items-center gap-2 mb-3 pb-2 border-b-2"
                    style={{ borderColor: color.border }}
                  >
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      <User size={14} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">
                        Participant: {group.transcriptTitle}
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        {group.items.length} quote{group.items.length !== 1 ? 's' : ''} for this code
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item, index) => (
                      <article
                        key={`${item.highlightId}-${item.codedAt}`}
                        className="p-4 bg-white border border-zinc-200 rounded-xl"
                        style={{ borderLeftWidth: 4, borderLeftColor: color.border }}
                      >
                        <p
                          className="text-[10px] font-medium uppercase tracking-wider mb-2"
                          style={{ color: color.text }}
                        >
                          {group.transcriptTitle} — Quote {index + 1}
                        </p>
                        <blockquote className="text-[15px] leading-relaxed text-zinc-800 pl-1 mb-3">
                          "{item.excerpt}"
                        </blockquote>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigateToTranscript(item.transcriptId, item.startOffset)
                          }
                          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
                        >
                          <ExternalLink size={12} />
                          Open in {group.transcriptTitle}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
