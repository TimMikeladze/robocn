"use client"

/**
 * Studio's small shared parts. The voice is the site's own — mono eyebrows,
 * hairline borders, the panel ground — so Studio reads as the same product as
 * the workbench it grew out of.
 */

import * as React from "react"
import { Check, Copy, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { eyebrow, fieldClass } from "@/components/studio/styles"
import type { ActionResult } from "@/lib/studio/action"
import { cn } from "@/lib/utils"

export { eyebrow, fieldClass }

export function PageHeader({
  eyebrow: label,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border px-5 py-5 sm:px-8">
      <div className="min-w-0">
        {label ? <p className={eyebrow}>{label}</p> : null}
        <h1 className="mt-0.5 truncate text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  )
}

export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-6 sm:px-8", className)} {...props} />
}

export function Section({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("border border-border bg-panel", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[14px] font-medium">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border px-6 py-14 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      {children ? (
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{children}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  error?: string | null
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[12px] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** A coloured dot and a name: workflow stages, labels, projects. */
export function Pill({
  color,
  children,
  className,
}: {
  color?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground",
        className,
      )}
    >
      {color ? (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string | (() => string)
  label?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof value === "function" ? value() : value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        } catch {
          toast.error("The clipboard is not available here.")
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  )
}

/**
 * A modal. Native `<dialog>`: focus trapping, Escape and the top layer come
 * with the element, which is most of what a dialog library is for.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow: label,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}) {
  const ref = React.useRef<HTMLDialogElement>(null)
  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // `showModal` focuses the first focusable thing, which is the close button.
      // A form's first field is what the person opened the dialog for.
      dialog
        .querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), textarea, select")
        ?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] border border-border bg-panel p-0 text-foreground shadow-xl backdrop:bg-background/80 backdrop:backdrop-blur-sm",
        { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" }[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              {label ? <p className={eyebrow}>{label}</p> : null}
              <h2 className="truncate text-[15px] font-medium">{title}</h2>
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  )
}

/** "Are you sure", for the things that cannot be taken back. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Delete",
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: React.ReactNode
  confirmLabel?: string
  pending?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13px] text-muted-foreground">{children}</div>
    </Modal>
  )
}

/**
 * Run a server action and say what happened. Returns the data on success and
 * `null` on failure, after toasting the error, so a caller's happy path is
 * one `if`.
 */
export function useAction() {
  const [pending, startTransition] = React.useTransition()
  const call = React.useCallback(
    <T,>(work: () => Promise<ActionResult<T>>, options: { success?: string } = {}) =>
      new Promise<T | null>((resolve) => {
        startTransition(async () => {
          try {
            const result = await work()
            if (result.ok) {
              if (options.success) toast.success(options.success)
              resolve(result.data ?? (undefined as T))
            } else {
              toast.error(result.error)
              resolve(null)
            }
          } catch {
            toast.error("Something went wrong. Try again.")
            resolve(null)
          }
        })
      }),
    [],
  )
  return { pending, call }
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/** `3 hours ago`. Rendered on the client only where it is used, so no hydration drift. */
export function timeAgo(date: Date | string, now = Date.now()) {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000)
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ]
  let value = seconds
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit)
    value /= size
  }
  return ""
}

/** The clock in ten-second steps: coarse enough to be a stable snapshot, fine enough for "now". */
const TICK = 10_000
const subscribeClock = (notify: () => void) => {
  const timer = window.setInterval(notify, TICK)
  return () => window.clearInterval(timer)
}
const clock = () => Math.floor(Date.now() / TICK)

/**
 * Relative time is a fact about *now*, which the server and the browser
 * disagree on. The server renders the absolute date; the browser swaps in the
 * relative one once it is the one telling the time.
 */
export function TimeAgo({ date }: { date: Date | string }) {
  const tick = React.useSyncExternalStore(subscribeClock, clock, () => null)
  const at = new Date(date)
  return (
    <time dateTime={at.toISOString()} title={at.toISOString().slice(0, 16).replace("T", " ") + " UTC"}>
      {tick === null ? at.toISOString().slice(0, 10) : timeAgo(at, (tick + 1) * TICK)}
    </time>
  )
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[9px] font-medium",
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
