import { describe, expect, it } from "vitest"

import {
  descendantIds,
  extensionOf,
  fileUrl,
  flattenTree,
  folderPath,
  folderTree,
  libraryHref,
  placeHref,
  type LibraryFolder,
  type LibraryState,
} from "@/components/studio/assets/shared"
import { uploadProblem } from "@/components/studio/assets/upload"
import { MAX_ASSET_BYTES } from "@/lib/studio/asset-kinds"

const folder = (id: string, parentId: string | null): LibraryFolder => ({ id, parentId, name: id, files: 0 })

const folders = [folder("brand", null), folder("logos", "brand"), folder("old", "logos"), folder("video", null)]

const state: LibraryState = {
  folderId: null,
  q: "",
  kind: null,
  tag: null,
  sort: "newest",
  view: "grid",
  trash: false,
}

describe("folder helpers", () => {
  it("nests folders and flattens them back in display order with depth", () => {
    const flat = flattenTree(folderTree(folders))
    expect(flat.map((node) => [node.id, node.depth])).toEqual([
      ["brand", 0],
      ["logos", 1],
      ["old", 2],
      ["video", 0],
    ])
  })

  it("surfaces an orphan at the top and survives a cycle", () => {
    expect(folderTree([folder("lost", "gone")]).map((node) => node.id)).toEqual(["lost"])
    expect(() => folderTree([folder("a", "b"), folder("b", "a")])).not.toThrow()
  })

  it("walks the path root-first and finds everything beneath a folder", () => {
    expect(folderPath(folders, "old").map((entry) => entry.id)).toEqual(["brand", "logos", "old"])
    expect(folderPath(folders, "missing")).toEqual([])
    expect([...descendantIds(folders, "brand")].sort()).toEqual(["brand", "logos", "old"])
  })
})

describe("library URLs", () => {
  it("keeps defaults out of the query string", () => {
    expect(libraryHref("acme", state)).toBe("/studio/acme/assets")
  })

  it("writes every filter, and lets the trash outrank a folder", () => {
    expect(
      libraryHref("acme", { ...state, folderId: "f1", q: " arm ", kind: "image", tag: "hero", sort: "name", view: "list" }),
    ).toBe("/studio/acme/assets?folder=f1&q=arm&kind=image&tag=hero&sort=name&view=list")
    expect(libraryHref("acme", { ...state, folderId: "f1", trash: true })).toBe("/studio/acme/assets?trash=1")
  })

  it("drops filters but keeps the view when moving to another place", () => {
    const busy: LibraryState = { ...state, q: "arm", kind: "image", tag: "hero", view: "list" }
    expect(placeHref("acme", busy, { folderId: "f2" })).toBe("/studio/acme/assets?folder=f2&view=list")
    expect(placeHref("acme", busy, "trash")).toBe("/studio/acme/assets?trash=1&view=list")
  })

  it("versions a file URL by when its bytes last changed", () => {
    expect(fileUrl("ast_1")).toBe("/api/studio/assets/ast_1/file")
    expect(fileUrl("ast_1", { thumb: true, version: "2026-01-01T00:00:00.000Z" })).toBe(
      "/api/studio/assets/ast_1/file?thumb=1&v=1767225600000",
    )
  })
})

describe("files", () => {
  it("reads an extension only when there is one", () => {
    expect(extensionOf("report.final.pdf")).toBe("PDF")
    expect(extensionOf(".gitignore")).toBe("")
    expect(extensionOf("README")).toBe("")
  })

  it("refuses empty and over-limit files before they are sent", () => {
    expect(uploadProblem({ size: 0 })).toMatch(/empty/)
    expect(uploadProblem({ size: MAX_ASSET_BYTES + 1 })).toMatch(/25\.0 MB/)
    expect(uploadProblem({ size: MAX_ASSET_BYTES })).toBeNull()
  })
})
