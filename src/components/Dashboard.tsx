import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { createProject, deleteProject, listProjects } from '../db/services'
import type { Project } from '../types'

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setProjects(await listProjects())
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    await createProject(title.trim())
    setTitle('')
    await load()
    setCreating(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return
    await deleteProject(id)
    await load()
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-medium text-zinc-900 tracking-tight mb-1">
          Reflexive Thematic Analysis
        </h1>
        <p className="text-sm text-zinc-500 mb-10">
          Local-first qualitative analysis. Your data stays in this browser.
        </p>

        <form onSubmit={handleCreate} className="flex gap-2 mb-10">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New project name…"
            className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <Plus size={15} />
            Create
          </button>
        </form>

        {projects.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-200 rounded-xl">
            <FileText size={28} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500">No projects yet. Create one to begin.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-3">
              Recent projects
            </p>
            {projects.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors"
              >
                <Link to={`/project/${p.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.title)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 rounded transition-all"
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
