"use client"

/**
 * The two panels that sit over the stage — setting the tool up, and starting a
 * machine that does not exist yet — share a frame and a copyable block.
 */

import * as React from "react"
import { Check, Copy, X } from "lucide-react"

/** A block of text meant for a terminal or an agent, with a copy button. */
function Command({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="relative">
      {label ? (
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
      ) : null}
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-background px-3 py-2 pr-10 font-mono text-[12px] leading-relaxed">
        {code}
      </pre>
      <button
        type="button"
        aria-label={`Copy ${label ?? "command"}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          } catch {
            /* Clipboard is unavailable; the text is right there to select. */
          }
        }}
        className="absolute bottom-2 right-2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

export interface WorkbenchDialogProps {
  eyebrow: string
  title: string
  onClose: () => void
  children: React.ReactNode
}

function WorkbenchDialog({ eyebrow, title, onClose, children }: WorkbenchDialogProps) {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm"
    >
      <div className="datum-frame w-full max-w-2xl border border-border bg-panel">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="text-[15px] font-medium">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-5 px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

export { Command, WorkbenchDialog }
