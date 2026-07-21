import { useEffect, useRef, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'

interface UndoToastProps {
  message: string
  durationMs?: number
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({
  message,
  durationMs = 30000,
  onUndo,
  onDismiss,
}: UndoToastProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000))
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const deadline = Date.now() + durationMs
    const interval = setInterval(() => {
      const remaining = Math.ceil((deadline - Date.now()) / 1000)
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onDismissRef.current()
      }
    }, 500)
    return () => clearInterval(interval)
  }, [durationMs])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-900 text-white rounded-xl shadow-lg border border-zinc-700 min-w-[280px]">
      <p className="text-sm flex-1">{message}</p>
      <button
        type="button"
        onClick={onUndo}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors shrink-0"
      >
        <RotateCcw size={13} />
        Undo
      </button>
      <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{secondsLeft}s</span>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-zinc-400 hover:text-white shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
