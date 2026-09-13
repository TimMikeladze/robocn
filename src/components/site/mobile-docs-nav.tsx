"use client"

import * as React from "react"

/** Native disclosure, closed again when a visitor chooses a documentation link. */
function MobileDocsNav({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDetailsElement>(null)

  return (
    <details ref={ref} className="border border-border bg-panel md:hidden"
      onClick={event => {
        if (event.target instanceof Element && event.target.closest("a") && ref.current) {
          ref.current.open = false
        }
      }}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Browse documentation</summary>
      <nav aria-label="Mobile documentation" className="max-h-[60vh] overflow-y-auto border-t border-border p-4">
        {children}
      </nav>
    </details>
  )
}

export { MobileDocsNav }
