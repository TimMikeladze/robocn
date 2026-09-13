import Link from "next/link"

import { docGroups, docs } from "@/lib/docs"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[13rem_1fr]">
      <nav className="md:sticky md:top-20 md:self-start">
        <ul className="space-y-6">
          {docGroups.map((group) => (
            <li key={group}>
              <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
                {group}
              </h2>
              <ul className="space-y-1 border-l border-border">
                {docs
                  .filter((entry) => entry.group === group)
                  .map((entry) => (
                    <li key={entry.slug}>
                      <Link
                        href={`/docs/${entry.slug}`}
                        className="-ml-px block border-l border-transparent py-0.5 pl-3 text-[13.5px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        {entry.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
