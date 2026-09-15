import { describe, expect, it } from "vitest"

import { centiseconds, encodeGif, lzwEncode, quantize } from "@/lib/robocn/gif"

/** Solid RGBA of one colour, so the quantizer's answer is knowable. */
const solid = (width: number, height: number, rgba: [number, number, number, number]) => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) data.set(rgba, index * 4)
  return data
}

/** The GIF's own LZW, read back — the only honest check that the writer is right. */
function lzwDecode(bytes: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize
  const end = clear + 1
  let codeSize = minCodeSize + 1
  let dictionary: number[][] = []
  const reset = () => {
    dictionary = []
    for (let index = 0; index < clear; index += 1) dictionary[index] = [index]
    dictionary[clear] = []
    dictionary[end] = []
    codeSize = minCodeSize + 1
  }
  reset()

  const out: number[] = []
  let bits = 0
  let held = 0
  let previous: number[] | null = null
  for (let at = 0; at <= bytes.length; at += 1) {
    if (at < bytes.length) {
      held |= bytes[at] << bits
      bits += 8
    }
    while (bits >= codeSize) {
      const code = held & ((1 << codeSize) - 1)
      held >>= codeSize
      bits -= codeSize
      if (code === end) return out
      if (code === clear) {
        reset()
        previous = null
        continue
      }
      let entry: number[]
      if (dictionary[code]) entry = dictionary[code]
      else if (previous) entry = [...previous, previous[0]]
      else throw new Error(`code ${code} with nothing before it`)
      out.push(...entry)
      if (previous) {
        dictionary.push([...previous, entry[0]])
        if (dictionary.length === 1 << codeSize && codeSize < 12) codeSize += 1
      }
      previous = entry
    }
  }
  return out
}

describe("quantize", () => {
  it("spends one colour on an image that only has one", () => {
    const { palette, indices, transparent } = quantize(solid(4, 4, [200, 30, 40, 255]))
    expect(transparent).toBeNull()
    expect(palette.length).toBe(3)
    expect([...palette]).toEqual([200, 30, 40])
    expect([...indices]).toEqual(Array(16).fill(0))
  })

  it("keeps distinct colours distinct, and maps every pixel to its own", () => {
    const data = new Uint8ClampedArray(3 * 4)
    data.set([255, 0, 0, 255], 0)
    data.set([0, 255, 0, 255], 4)
    data.set([0, 0, 255, 255], 8)
    const { palette, indices } = quantize(data)
    expect(palette.length / 3).toBe(3)
    const colour = (index: number) => [...palette.subarray(index * 3, index * 3 + 3)]
    expect(colour(indices[0])).toEqual([255, 0, 0])
    expect(colour(indices[1])).toEqual([0, 255, 0])
    expect(colour(indices[2])).toEqual([0, 0, 255])
  })

  it("reserves index 0 for the hole, and only when there is one", () => {
    const data = new Uint8ClampedArray(2 * 4)
    data.set([10, 20, 30, 255], 0)
    data.set([0, 0, 0, 0], 4)
    const { indices, transparent } = quantize(data)
    expect(transparent).toBe(0)
    expect(indices[1]).toBe(0)
    expect(indices[0]).not.toBe(0)
  })

  it("never asks for more than the table holds", () => {
    // A gradient has far more than 256 distinct colours; the palette is capped
    // and every pixel still lands on a real entry.
    const data = new Uint8ClampedArray(1024 * 4)
    for (let index = 0; index < 1024; index += 1) {
      data.set([index % 256, (index * 3) % 256, (index * 7) % 256, 255], index * 4)
    }
    const { palette, indices } = quantize(data)
    expect(palette.length / 3).toBeLessThanOrEqual(256)
    expect(Math.max(...indices)).toBeLessThan(palette.length / 3)
  })
})

describe("the LZW stream", () => {
  it("round-trips the indices it was given", () => {
    const indices = Uint8Array.from([1, 1, 1, 2, 3, 3, 2, 1, 0, 0, 0, 0, 5, 5, 5, 1])
    expect(lzwDecode(lzwEncode(indices, 4), 4)).toEqual([...indices])
  })

  it("round-trips a run long enough to grow the code size", () => {
    const indices = new Uint8Array(4000)
    for (let index = 0; index < indices.length; index += 1) indices[index] = index % 17
    expect(lzwDecode(lzwEncode(indices, 5), 5)).toEqual([...indices])
  })

  it("starts with a clear code and ends with an end-of-information", () => {
    const bytes = lzwEncode(Uint8Array.from([0, 1, 2]), 2)
    expect(bytes[0] & 0b111).toBe(4) // the clear code, in the low bits of a 3-bit code
    expect(lzwDecode(bytes, 2)).toEqual([0, 1, 2])
  })
})

describe("centiseconds", () => {
  it("rounds milliseconds to the format's ticks, with a floor no viewer ignores", () => {
    expect(centiseconds(100)).toBe(10)
    expect(centiseconds(66)).toBe(7)
    expect(centiseconds(1)).toBe(2)
  })
})

describe("encodeGif", () => {
  const ascii = (bytes: Uint8Array, at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length))

  it("writes a GIF89a with the canvas size, a loop block and a trailer", () => {
    const gif = encodeGif([{ data: solid(8, 4, [12, 34, 56, 255]), delay: 100 }], {
      width: 8,
      height: 4,
    })
    expect(ascii(gif, 0, 6)).toBe("GIF89a")
    expect(gif[6] | (gif[7] << 8)).toBe(8)
    expect(gif[8] | (gif[9] << 8)).toBe(4)
    expect(ascii(gif, 16, 11)).toBe("NETSCAPE2.0")
    expect(gif[gif.length - 1]).toBe(0x3b)
  })

  it("writes one image descriptor per frame", () => {
    const frames = [
      { data: solid(4, 4, [255, 0, 0, 255]), delay: 80 },
      { data: solid(4, 4, [0, 255, 0, 255]), delay: 80 },
      { data: solid(4, 4, [0, 0, 255, 255]), delay: 80 },
    ]
    const gif = encodeGif(frames, { width: 4, height: 4 })
    let descriptors = 0
    for (let at = 0; at < gif.length; at += 1) {
      // A graphic control extension always precedes its image descriptor, which
      // is enough to count them without walking the whole block structure.
      if (gif[at] === 0x21 && gif[at + 1] === 0xf9) descriptors += 1
    }
    expect(descriptors).toBe(3)
  })

  it("disposes to the background only when a frame has a hole in it", () => {
    const opaque = encodeGif([{ data: solid(2, 2, [1, 2, 3, 255]), delay: 40 }], {
      width: 2,
      height: 2,
    })
    const holed = encodeGif([{ data: solid(2, 2, [1, 2, 3, 0]), delay: 40 }], {
      width: 2,
      height: 2,
    })
    const packedAt = (gif: Uint8Array) => {
      const at = gif.findIndex((byte, index) => byte === 0x21 && gif[index + 1] === 0xf9)
      return gif[at + 3]
    }
    expect(packedAt(opaque) >> 2).toBe(1)
    expect(packedAt(opaque) & 1).toBe(0)
    expect(packedAt(holed) >> 2).toBe(2)
    expect(packedAt(holed) & 1).toBe(1)
  })

  it("refuses to write a file with no frames in it", () => {
    expect(() => encodeGif([], { width: 4, height: 4 })).toThrow(/at least one frame/)
  })
})
