import Link from "next/link"

import { rail } from "@/components/site/rail"
import { site } from "@/lib/site"
import { cn } from "@/lib/utils"

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className={cn(rail, "flex flex-col gap-2 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between")}>
        <p>
          Robotic components you can install, theme, and control in your own app.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <a href={site.repository} className="hover:text-foreground" target="_blank" rel="noreferrer">
            Source
          </a>
          <a href={site.author.portfolio} className="hover:text-foreground" target="_blank" rel="noreferrer">
            linesofcode.dev
          </a>
          <a href={site.author.twitter} className="hover:text-foreground" target="_blank" rel="noreferrer">
            Twitter
          </a>
          <a href={site.author.linkedin} className="hover:text-foreground" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a href="https://ui.shadcn.com/docs/registry" className="hover:text-foreground" target="_blank" rel="noreferrer">
            shadcn registry
          </a>
        </div>
      </div>
    </footer>
  )
}

export { SiteFooter }
