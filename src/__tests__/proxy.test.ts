import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { proxy } from "@/proxy"

/**
 * The `.md` mirrors only exist because this file routes them: a docs URL that
 * stops being rewritten silently starts returning HTML to an agent that asked
 * for text. The rewrite target is in the `x-middleware-rewrite` header.
 */

const rewriteOf = (path: string, headers: Record<string, string> = {}) => {
  const response = proxy(new NextRequest(`https://robocn.dev${path}`, { headers }))
  const target = response.headers.get("x-middleware-rewrite")
  return target ? new URL(target).pathname : null
}

describe("markdown proxy", () => {
  it("routes a `.md` URL to the mirror", () => {
    expect(rewriteOf("/docs/robot-arm.md")).toBe("/api/md/docs/robot-arm")
    expect(rewriteOf("/docs.md")).toBe("/api/md/docs")
  })

  it("routes a docs URL that asks for Markdown by name", () => {
    expect(rewriteOf("/docs/robot-arm", { accept: "text/markdown" })).toBe(
      "/api/md/docs/robot-arm",
    )
    expect(rewriteOf("/docs", { accept: "text/markdown, text/plain" })).toBe("/api/md/docs")
  })

  it("leaves a browser alone", () => {
    // `*/*` tolerates Markdown; it does not ask for it, and a visitor who
    // followed a link wants the page.
    expect(rewriteOf("/docs/robot-arm", { accept: "text/html,*/*" })).toBeNull()
    expect(rewriteOf("/docs/robot-arm")).toBeNull()
    expect(rewriteOf("/docs")).toBeNull()
  })

  it("does not rewrite a slug that merely contains .md", () => {
    expect(rewriteOf("/docs/robot-arm.md.html")).toBeNull()
  })
})
