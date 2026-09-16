import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { packIco } from "../lib/ico.mjs"

/**
 * `pnpm icons` writes `src/app/favicon.ico` from the same mark the app bar
 * draws. Both halves are checked: the container this repo writes by hand, and
 * the file that actually shipped — the second is what catches a framework's
 * default favicon reappearing. `docs/analytics.md` is unrelated; the mark is
 * `docs/logo.md`.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

/** Reads an ICO back: one `{ size, data }` per directory entry. */
function unpackIco(file: Buffer) {
  expect(file.readUInt16LE(0)).toBe(0)
  expect(file.readUInt16LE(2)).toBe(1)
  const count = file.readUInt16LE(4)
  return Array.from({ length: count }, (_, i) => {
    const at = 6 + i * 16
    const width = file.readUInt8(at)
    const offset = file.readUInt32LE(at + 12)
    const length = file.readUInt32LE(at + 8)
    return { size: width === 0 ? 256 : width, data: file.subarray(offset, offset + length) }
  })
}

describe("packIco", () => {
  it("round-trips every frame at its declared size and offset", () => {
    const frames = [
      { size: 16, data: Buffer.alloc(40, 1) },
      { size: 48, data: Buffer.alloc(90, 2) },
    ]
    const unpacked = unpackIco(packIco(frames))
    expect(unpacked.map((frame) => frame.size)).toEqual([16, 48])
    expect(unpacked[0].data).toEqual(frames[0].data)
    expect(unpacked[1].data).toEqual(frames[1].data)
  })

  it("writes 256 as the zero the format asks for", () => {
    const packed = packIco([{ size: 256, data: Buffer.alloc(8) }])
    expect(packed.readUInt8(6)).toBe(0)
    expect(unpackIco(packed)[0].size).toBe(256)
  })

  it("refuses a size no directory entry can hold", () => {
    expect(() => packIco([{ size: 512, data: Buffer.alloc(8) }])).toThrow(/1…256/)
    expect(() => packIco([])).toThrow()
  })
})

describe("the shipped favicon", () => {
  it("is the mark, at the three sizes a browser asks for", () => {
    const frames = unpackIco(readFileSync("src/app/favicon.ico"))
    expect(frames.map((frame) => frame.size)).toEqual([16, 32, 48])
    for (const frame of frames) {
      expect(frame.data.subarray(0, 4)).toEqual(PNG_MAGIC)
    }
  })
})
