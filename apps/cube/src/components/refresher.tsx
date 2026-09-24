"use client"

/**
 * Refreshes a server-rendered page on an interval and on focus, so the log
 * stays current without any client-side data plumbing.
 */

import * as React from "react"
import { useRouter } from "next/navigation"

export function Refresher({ everyMs = 15_000 }: { everyMs?: number }) {
  const router = useRouter()

  React.useEffect(() => {
    const refresh = () => {
      if (!document.hidden) router.refresh()
    }
    const every = window.setInterval(refresh, everyMs)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(every)
      window.removeEventListener("focus", refresh)
    }
  }, [everyMs, router])

  return null
}
