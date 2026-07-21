import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  GripVertical,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react'
import {
  buildCodeTree,
  createCode,
  listCodes,
  listMemos,
  moveCode,
  updateCode,
} from '../db/services'
import {
  createCodebookBackup,
  deleteCodeWithBackup,
  maybeAutoCodebookBackup,
} from '../db/backup'
import type { Code, CodeWithCount, Memo } from '../types'
import type { CodeDeleteSnapshot } from '../types/backup'

const CODE_DRAG_TYPE = 'application/x-qda-code-id'

interface RightSidebarProps {
  projectId: string
  selectedCodeId: string | null
  onSelectCode: (id: string | null) => void
  onAssignCode: (codeId: string) => void
  onOpenCodeMemo: (code: Code, memo: Memo | null) => void
  refreshKey: number
  onDataChanged: () => void
  onCodeDeleted: (undoSnapshot: CodeDeleteSnapshot | null) => void
}

type DropTarget =
  | { type: 'root' }
  | { type: 'nest'; parentId: string }

function CodeTreeNode({
  node,
  depth,
  selectedCodeId,
  draggingId,
  dropTarget,
  onSelect,
  onAddChild,
  onDelete,
  onMemo,
  onRename,
  editingCodeId,
  onStartRename,
  onCancelRename,
  onDragStart,
  onDragEnd,
  onDragOverNest,
  onDropNest,
}: {
  node: CodeWithCount
  depth: number
  selectedCodeId: string | null
  draggingId: string | null
  dropTarget: DropTarget | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
  onDelete: (id: string) => void
  onMemo: (code: Code) => void
  onRename: (id: string, name: string) => void
  editingCodeId: string | null
  onStartRename: (id: string) => void
  onCancelRename: () => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOverNest: (parentId: string) => void
  onDropNest: (parentId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [editName, setEditName] = useState(node.name)
  const editRef = useRef<HTMLInputElement>(null)
  const isEditing = editingCodeId === node.id
  const hasChildren = node.children.length > 0
  const isDragging = draggingId === node.id
  const isNestTarget =
    dropTarget?.type === 'nest' && dropTarget.parentId === node.id && draggingId !== node.id

  const commitRename = () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== node.name) {
      onRename(node.id, trimmed)
    } else {
      setEditName(node.name)
      onCancelRename()
    }
  }

  useEffect(() => {
    if (isEditing) {
      setEditName(node.name)
      editRef.current?.focus()
      editRef.current?.select()
    }
  }, [isEditing, node.name])

  return (
    <div className={isDragging ? 'opacity-40' : ''}>
      <div
        className={`group flex items-center gap-0.5 pr-1 py-1 rounded-md text-sm transition-colors ${
          isNestTarget
            ? 'bg-zinc-300/60 ring-2 ring-zinc-400 ring-inset'
            : selectedCodeId === node.id
              ? 'bg-zinc-200/70 text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onDragOver={(e) => {
          if (!draggingId || draggingId === node.id) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOverNest(node.id)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const codeId = e.dataTransfer.getData(CODE_DRAG_TYPE)
          if (codeId && codeId !== node.id) onDropNest(node.id)
        }}
      >
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(CODE_DRAG_TYPE, node.id)
            e.dataTransfer.effectAllowed = 'move'
            onDragStart(node.id)
          }}
          onDragEnd={onDragEnd}
          className="p-0.5 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorganise"
        >
          <GripVertical size={12} />
        </span>

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(!open)
            }}
            className="p-0.5 text-zinc-400 shrink-0"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {isEditing ? (
          <input
            ref={editRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setEditName(node.name)
                onCancelRename()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-zinc-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditName(node.name)
              onStartRename(node.id)
            }}
            className="flex-1 text-left truncate"
          >
            {node.name}
          </button>
        )}

        <span className="text-[10px] tabular-nums text-zinc-400 mr-0.5">{node.count}</span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setEditName(node.name)
            onStartRename(node.id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-zinc-700"
          title="Rename code"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMemo(node)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-zinc-700"
          title="Code memo"
        >
          <StickyNote size={11} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddChild(node.id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-zinc-700"
          title="Add child code"
        >
          <Plus size={11} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(node.id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-500"
          title="Delete code"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {open &&
        node.children.map((child) => (
          <CodeTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedCodeId={selectedCodeId}
            draggingId={draggingId}
            dropTarget={dropTarget}
            onSelect={onSelect}
            onAddChild={onAddChild}
            onDelete={onDelete}
            onMemo={onMemo}
            onRename={onRename}
            editingCodeId={editingCodeId}
            onStartRename={onStartRename}
            onCancelRename={onCancelRename}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverNest={onDragOverNest}
            onDropNest={onDropNest}
          />
        ))}
    </div>
  )
}

export function RightSidebar({
  projectId,
  selectedCodeId,
  onSelectCode,
  onAssignCode,
  onOpenCodeMemo,
  refreshKey,
  onDataChanged,
  onCodeDeleted,
}: RightSidebarProps) {
  const [tree, setTree] = useState<CodeWithCount[]>([])
  const [flatCodes, setFlatCodes] = useState<Code[]>([])
  const [search, setSearch] = useState('')
  const [newCodeName, setNewCodeName] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)

  const load = async () => {
    setTree(await buildCodeTree(projectId))
    setFlatCodes(await listCodes(projectId))
  }

  useEffect(() => {
    load()
  }, [projectId, refreshKey])

  const suggestions = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return flatCodes.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [search, flatCodes])

  const handleMove = async (codeId: string, newParentId: string | null) => {
    const result = await moveCode(codeId, newParentId)
    if (!result.ok) {
      alert(result.error)
      return
    }
    setDraggingId(null)
    setDropTarget(null)
    await maybeAutoCodebookBackup(projectId)
    await load()
    onDataChanged()
  }

  const handleCreateRoot = async () => {
    const name = newCodeName.trim()
    if (!name) return
    await createCode(projectId, name, null)
    setNewCodeName('')
    await maybeAutoCodebookBackup(projectId)
    await load()
    onDataChanged()
  }

  const handleAddChild = async (parentId: string) => {
    const name = prompt('Child code name:')
    if (!name?.trim()) return
    await createCode(projectId, name.trim(), parentId)
    await maybeAutoCodebookBackup(projectId)
    await load()
    onDataChanged()
  }

  const handleDelete = async (id: string) => {
    const code = flatCodes.find((c) => c.id === id)
    if (!code) return
    if (
      !confirm(
        `Delete code "${code.name}"? A codebook backup will be saved and you can undo for 30 seconds.`,
      )
    ) {
      return
    }

    const result = await deleteCodeWithBackup(id)
    if (!result.ok) {
      alert(result.error)
      return
    }
    if (selectedCodeId === id) onSelectCode(null)
    onCodeDeleted(result.undoSnapshot ?? null)
    await load()
    onDataChanged()
  }

  const handleMemo = async (code: Code) => {
    const memos = await listMemos(projectId, 'code', code.id)
    onOpenCodeMemo(code, memos[0] ?? null)
  }

  const handleRename = async (id: string, name: string) => {
    await createCodebookBackup(projectId, `Before rename`, 'before_edit')
    await updateCode(id, { name })
    setEditingCodeId(null)
    await maybeAutoCodebookBackup(projectId)
    await load()
    onDataChanged()
  }

  const isRootDropTarget = dropTarget?.type === 'root' && draggingId !== null

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-zinc-200 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search codes to assign…"
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300"
          />
        </div>
        {suggestions.length > 0 && (
          <ul className="border border-zinc-200 rounded-md bg-white overflow-hidden">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAssignCode(c.id)
                    setSearch('')
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-zinc-700 hover:bg-zinc-50"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1">
          <input
            type="text"
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateRoot()}
            placeholder="New root code…"
            className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-zinc-300"
          />
          <button
            type="button"
            onClick={handleCreateRoot}
            className="px-2 py-1.5 text-xs bg-zinc-800 text-white rounded-md hover:bg-zinc-700"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto py-1 flex flex-col min-h-0"
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) {
            setDropTarget(null)
          }
        }}
      >
        <div
          className={`mx-2 mb-2 px-2 py-2 rounded-md border border-dashed text-[11px] flex items-center gap-1.5 transition-colors ${
            isRootDropTarget
              ? 'border-zinc-500 bg-zinc-200/80 text-zinc-700'
              : 'border-zinc-200 text-zinc-400'
          }`}
          onDragOver={(e) => {
            if (!draggingId) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropTarget({ type: 'root' })
          }}
          onDrop={(e) => {
            e.preventDefault()
            const codeId = e.dataTransfer.getData(CODE_DRAG_TYPE)
            if (codeId) handleMove(codeId, null)
          }}
        >
          <FolderInput size={12} />
          Drop here to move to root level
        </div>

        {tree.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-400 text-center">
            No codes yet. Drag codes onto each other to create folders.
          </p>
        ) : (
          tree.map((node) => (
            <CodeTreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedCodeId={selectedCodeId}
              draggingId={draggingId}
              dropTarget={dropTarget}
              onSelect={onSelectCode}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
              onMemo={handleMemo}
              onRename={handleRename}
              editingCodeId={editingCodeId}
              onStartRename={setEditingCodeId}
              onCancelRename={() => setEditingCodeId(null)}
              onDragStart={setDraggingId}
              onDragEnd={() => {
                setDraggingId(null)
                setDropTarget(null)
              }}
              onDragOverNest={(parentId) => setDropTarget({ type: 'nest', parentId })}
              onDropNest={(parentId) => {
                if (draggingId) handleMove(draggingId, parentId)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
