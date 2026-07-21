import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { ReactNode } from 'react'

interface CollapsibleSidebarProps {
  side: 'left' | 'right'
  collapsed: boolean
  onToggle: () => void
  title: string
  children: ReactNode
  width?: string
}

export function CollapsibleSidebar({
  side,
  collapsed,
  onToggle,
  title,
  children,
  width = 'w-64',
}: CollapsibleSidebarProps) {
  const ToggleIcon =
    side === 'left'
      ? collapsed
        ? PanelLeftOpen
        : PanelLeftClose
      : collapsed
        ? PanelRightOpen
        : PanelRightClose

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-zinc-200 bg-zinc-50 py-3 w-10 shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
          title={`Expand ${title}`}
        >
          <ToggleIcon size={16} />
        </button>
      </div>
    )
  }

  return (
    <aside
      className={`${width} shrink-0 flex flex-col border-zinc-200 bg-zinc-50 ${
        side === 'left' ? 'border-r' : 'border-l'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors"
        >
          <ToggleIcon size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  )
}
