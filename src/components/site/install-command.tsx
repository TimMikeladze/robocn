"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { defaultManager, installCommand, packageManagers, type PackageManager } from "@/lib/site"
import { cn } from "@/lib/utils"

export interface InstallCommandProps extends React.ComponentProps<"div"> {
  /** Registry item name, e.g. `robot-arm`. */
  item: string
}

/** The one line a visitor came for, in their package manager. */
function InstallCommand({ item, className, ...props }: InstallCommandProps) {
  const [manager, setManager] = React.useState<PackageManager>(defaultManager)
  const [copied, setCopied] = React.useState(false)
  const command = installCommand(item, manager)

  return (
    <div className={cn("border border-border bg-panel", className)} {...props}>
      <div className="flex items-center gap-1 border-b border-border px-1.5">
        {packageManagers.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setManager(option)}
            className={cn(
              "border-b-2 border-transparent px-2 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors",
              manager === option && "border-signal text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* The command is the point of the page: wrap it rather than clip it. */}
        <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all">
          {command}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          aria-label={copied ? "Copied" : "Copy install command"}
          onClick={async () => {
            await navigator.clipboard.writeText(command)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}

export { InstallCommand }
