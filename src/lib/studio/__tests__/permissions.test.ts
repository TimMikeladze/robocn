import { describe, expect, it } from "vitest"

import {
  assignableRoles,
  can,
  canManageMembers,
  isOwner,
  parseRoles,
} from "@/lib/studio/permissions"

describe("parseRoles", () => {
  it("reads better-auth's stock `member` as editor", () => {
    expect(parseRoles("member")).toEqual(["editor"])
  })

  it("splits a comma-joined string and drops what it does not know", () => {
    expect(parseRoles("viewer, admin,janitor")).toEqual(["viewer", "admin"])
  })

  it("is empty for nothing", () => {
    expect(parseRoles(null)).toEqual([])
    expect(parseRoles("")).toEqual([])
  })
})

describe("can", () => {
  it("lets a viewer comment and nothing else", () => {
    expect(can("viewer", "comment:create")).toBe(true)
    expect(can("viewer", "comment:resolve")).toBe(false)
    expect(can("viewer", "design:create")).toBe(false)
    expect(can("viewer", "asset:create")).toBe(false)
  })

  it("lets an editor make and publish, but not run the organization", () => {
    expect(can("editor", "design:publish")).toBe(true)
    expect(can("editor", "palette:delete")).toBe(true)
    expect(can("editor", "project:delete")).toBe(true)
    expect(can("editor", "settings:update")).toBe(false)
  })

  it("gives admins and owners everything", () => {
    for (const role of ["admin", "owner"]) {
      expect(can(role, "settings:update")).toBe(true)
      expect(can(role, "design:delete")).toBe(true)
    }
  })

  it("grants what any one of several roles grants", () => {
    expect(can("viewer,admin", "settings:update")).toBe(true)
  })

  it("refuses a missing or unknown role", () => {
    expect(can(null, "comment:create")).toBe(false)
    expect(can("janitor", "comment:create")).toBe(false)
  })
})

describe("managing members", () => {
  it("is for owners and admins", () => {
    expect(canManageMembers("owner")).toBe(true)
    expect(canManageMembers("admin")).toBe(true)
    expect(canManageMembers("editor")).toBe(false)
    expect(canManageMembers("member")).toBe(false)
    expect(isOwner("admin,owner")).toBe(true)
    expect(isOwner("admin")).toBe(false)
  })

  it("never hands out a role above the giver's own", () => {
    expect(assignableRoles("owner")).toEqual(["owner", "admin", "editor", "viewer"])
    expect(assignableRoles("admin")).toEqual(["admin", "editor", "viewer"])
    expect(assignableRoles("editor")).toEqual([])
    expect(assignableRoles(undefined)).toEqual([])
  })
})
