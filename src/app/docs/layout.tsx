import Link from "next/link"
import { MobileDocsNav } from "@/components/site/mobile-docs-nav"

import { rail } from "@/components/site/rail"
import { docGroups, docs } from "@/lib/docs"
import { cn } from "@/lib/utils"

function NavigationLinks() {
  return (
    <ul className="space-y-6">
      {docGroups.map(group => (
        <li key={group}>
          <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">{group}</h2>
          <ul className="space-y-1 border-l border-border">
            {docs.filter(entry => entry.group === group).map(entry => (
              <li key={entry.slug}>
                <Link href={`/docs/${entry.slug}`}
                  className="-ml-px block border-l border-transparent py-1 pl-3 text-[13.5px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground">
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(rail, "grid gap-6 py-6 md:grid-cols-[13rem_1fr] md:gap-10 md:py-10")}>
      <MobileDocsNav>
          <Link href="/docs" className="mb-5 block text-sm underline underline-offset-4">Search all components</Link>
          <NavigationLinks />
      </MobileDocsNav>
      <nav aria-label="Documentation" className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto pr-3 md:block">
        <Link href="/docs" className="mb-5 block text-sm underline underline-offset-4">Search all components</Link>
        <NavigationLinks />
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
