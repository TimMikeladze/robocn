"use client"

/**
 * The toolbar's end of the checkout.
 *
 * Four states, and the button says which one it is in: no picker in this
 * browser, nothing held, a folder remembered but not yet re-granted, and a
 * folder open. The fourth one names the folder, because "a folder" is not
 * enough information to write files into.
 */

import * as React from "react"
import { FolderCheck, FolderOpen, Loader2, Unplug } from "lucide-react"

import { useCheckout } from "@/components/workbench/checkout"
import { cn } from "@/lib/utils"

export interface CheckoutButtonProps {
  className?: string
}

function CheckoutButton({ className }: CheckoutButtonProps) {
  const checkout = useCheckout()
  const [open, setOpen] = React.useState(false)

  if (!checkout.supported) return null

  if (checkout.root) {
    return (
      <span className="relative">
        <button
          type="button"
          className={cn(className, "max-w-44")}
          aria-pressed={open}
          onClick={() => setOpen((value) => !value)}
          title={`Holding ${checkout.root} — ${checkout.files.size} files watched`}
        >
          <FolderCheck className="size-3.5 shrink-0 text-emerald-500" />
          <span className="truncate">{checkout.root}</span>
        </button>
        {open ? (
          <span className="absolute right-0 top-8 z-40 flex w-60 flex-col gap-1 rounded-sm border border-border bg-background p-2 shadow-md">
            <span className="px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Folder
            </span>
            <span className="px-1 font-mono text-[11px] break-all">{checkout.root}</span>
            <span className="px-1 font-mono text-[11px] text-muted-foreground">
              {checkout.files.size} files watched
              {checkout.isRobocn ? "" : " · this does not look like a robocn checkout"}
            </span>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:bg-accent"
              onClick={() => {
                setOpen(false)
                void checkout.disconnect()
              }}
            >
              <Unplug className="size-3.5" /> Close folder
            </button>
          </span>
        ) : null}
      </span>
    )
  }

  const restoring = Boolean(checkout.pending)
  return (
    <button
      type="button"
      className={className}
      disabled={checkout.busy}
      onClick={() => void (restoring ? checkout.reconnect() : checkout.connect())}
      title={
        restoring
          ? `Reopen ${checkout.pending} — browsers drop the grant when they restart`
          : "Hold a folder: read and write this checkout from the page"
      }
    >
      {checkout.busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FolderOpen className="size-3.5" />
      )}
      {restoring ? `Reconnect ${checkout.pending}` : "Folder"}
    </button>
  )
}

export { CheckoutButton }
