import { describe, expect, it } from "vitest"

import { addPose, parseShelf, removePose, serializeShelf, type SavedPose } from "@/lib/fs/poses"

const pose = (over: Partial<SavedPose> = {}): SavedPose => ({
  id: "a",
  name: "Three quarters",
  component: "robot-arm",
  search: "c=robot-arm&p.view=iso",
  savedAt: 1,
  ...over,
})

describe("parseShelf", () => {
  it("reads the shape it writes, newest first", () => {
    const shelf = [pose({ id: "a", savedAt: 1 }), pose({ id: "b", savedAt: 2 })]
    expect(parseShelf(serializeShelf(shelf)).map((entry) => entry.id)).toEqual(["b", "a"])
  })

  it("reads a bare array too, so an older file still opens", () => {
    expect(parseShelf(JSON.stringify([pose()]))).toHaveLength(1)
  })

  it("is empty rather than broken for anything it cannot use", () => {
    expect(parseShelf(undefined)).toEqual([])
    expect(parseShelf("{ not json")).toEqual([])
    expect(parseShelf(JSON.stringify({ poses: [{ id: "a" }] }))).toEqual([])
  })
})

describe("addPose", () => {
  it("replaces a pose with the same name on the same machine", () => {
    const shelf = [pose({ id: "a", name: "Three quarters" })]
    const next = addPose(shelf, pose({ id: "b", name: "  three QUARTERS  ", savedAt: 2 }))
    expect(next.map((entry) => entry.id)).toEqual(["b"])
  })

  it("keeps the same name against a different machine", () => {
    const shelf = [pose({ id: "a" })]
    const next = addPose(shelf, pose({ id: "b", component: "robot-dog", savedAt: 2 }))
    expect(next).toHaveLength(2)
  })
})

describe("removePose", () => {
  it("drops one by id", () => {
    expect(removePose([pose({ id: "a" }), pose({ id: "b" })], "a").map((entry) => entry.id)).toEqual([
      "b",
    ])
  })
})
