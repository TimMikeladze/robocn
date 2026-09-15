"use client"

/**
 * The row beside a docs page title: copy the page as Markdown, or hand it to an
 * assistant.
 *
 * Every entry here goes through the `.md` mirror rather than the HTML page —
 * `docs/site-polish.md` for why the mirrors exist. An assistant handed
 * `/docs/robot-arm.md` gets the install line, the props table and the source
 * list as text; handed the HTML it gets a hydration payload.
 */

import * as React from "react"
import { Check, ChevronDown, Copy, ExternalLink, FileText } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** The prompt an assistant is opened with, around the page's own URL. */
const ask = (url: string) =>
  `Read ${url} and help me use this robocn component in my project.`

const assistants = [
  { label: "Open in ChatGPT", href: (url: string) => `https://chatgpt.com/?q=${encodeURIComponent(ask(url))}` },
  { label: "Open in Claude", href: (url: string) => `https://claude.ai/new?q=${encodeURIComponent(ask(url))}` },
] as const

function PageActions({ slug }: { slug: string }) {
  const [copied, setCopied] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  /** Absolute, because it is going into somebody else's prompt box. */
  const markdownUrl = (absolute = false) => {
    const path = `/docs/${slug}.md`
    return absolute && typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : path
  }

  async function copyMarkdown() {
    try {
      const response = await fetch(markdownUrl())
      if (!response.ok) throw new Error(String(response.status))
      await navigator.clipboard.writeText(await response.text())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // A denied clipboard or a failed fetch: say so rather than showing a tick
      // for something that did not happen.
      setFailed(true)
      window.setTimeout(() => setFailed(false), 2400)
    }
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={copyMarkdown}
        aria-label="Copy this page as Markdown"
        className="inline-flex h-8 items-center gap-1.5 rounded-l-md border border-border bg-panel px-2.5 text-[12.5px] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {failed ? "Copy failed" : copied ? "Copied" : "Copy page"}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More page actions"
          className="inline-flex h-8 items-center rounded-r-md border border-l-0 border-border bg-panel px-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            render={
              <a href={markdownUrl()} target="_blank" rel="noreferrer">
                <FileText className="size-3.5" />
                View as Markdown
              </a>
            }
          />
          {assistants.map((assistant) => (
            <DropdownMenuItem
              key={assistant.label}
              // Resolved at click time: `window` is not there on the server.
              onClick={() => window.open(assistant.href(markdownUrl(true)), "_blank", "noreferrer")}
            >
              <ExternalLink className="size-3.5" />
              {assistant.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export { PageActions }
