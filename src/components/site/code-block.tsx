"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface CodeBlockProps extends React.ComponentProps<"div"> {
  code: string
  /** Shown in the strip above the code — a filename or a command name. */
  caption?: string
  /** Cap the height and scroll instead of running long. */
  scroll?: boolean
}

function CodeBlock({ code, caption, scroll, className, ...props }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border bg-panel",
        className,
      )}
      {...props}
    >
      {caption ? (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          <span>{caption}</span>
        </div>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute top-1.5 right-1.5 size-7 text-muted-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      <pre
        className={cn(
          "overflow-x-auto p-3 pr-10 font-mono text-[12.5px] leading-relaxed",
          scroll && "max-h-[28rem] overflow-y-auto",
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

export { CodeBlock }
