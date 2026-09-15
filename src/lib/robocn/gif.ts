/**
 * A GIF89a encoder, in TypeScript, with no dependencies.
 *
 * Written for flat vector art: median-cut quantization on a 5-bit histogram, a
 * nearest-colour cache keyed by that same 15-bit index, LZW with dictionary
 * resets, and a **local** colour table per frame. Drawings here use few colours
 * and hard edges, so a per-frame table is smaller and exact where one global
 * table would be neither, and there is no dithering to make a flat fill crawl
 * between frames.
 *
 * Reasoning and the format choices: `docs/export.md`.
 */

/** One frame: RGBA bytes, and how long it stays on screen. */
export interface GifFrame {
  /** `width * height * 4` bytes, straight from a canvas. */
  data: Uint8ClampedArray | Uint8Array
  /** Milliseconds. GIF stores hundredths, so this is rounded to 10 ms. */
  delay: number
}

export interface GifOptions {
  width: number
  height: number
  /** Repeat count; 0 — the default — is forever. */
  loop?: number
  /** Alpha at or below this is written as the transparent index. */
  alphaThreshold?: number
}

export interface Quantized {
  /** Up to 256 colours, three bytes each, in table order. */
  palette: Uint8Array
  /** One palette index per pixel. */
  indices: Uint8Array
  /** The index reserved for transparency, or null when the frame is opaque. */
  transparent: number | null
}

/** GIF counts time in hundredths of a second, and browsers floor a 1 to 10 ms. */
export const centiseconds = (ms: number) => Math.max(2, Math.round(ms / 10))

/** The 15-bit histogram key: five bits a channel, the precision of the cut. */
const key = (r: number, g: number, b: number) =>
  ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)

interface Bucket {
  count: number
  r: number
  g: number
  b: number
  key: number
}

interface Box {
  buckets: Bucket[]
  count: number
}

/** The channel a box is widest in — the one worth splitting. */
function widest(box: Box): { channel: "r" | "g" | "b"; range: number } {
  let lowR = 255
  let highR = 0
  let lowG = 255
  let highG = 0
  let lowB = 255
  let highB = 0
  for (const bucket of box.buckets) {
    const r = bucket.r / bucket.count
    const g = bucket.g / bucket.count
    const b = bucket.b / bucket.count
    if (r < lowR) lowR = r
    if (r > highR) highR = r
    if (g < lowG) lowG = g
    if (g > highG) highG = g
    if (b < lowB) lowB = b
    if (b > highB) highB = b
  }
  // Weighted the way the eye is, so a green box splits before a blue one of the
  // same numeric width.
  const spread = [
    { channel: "r" as const, range: (highR - lowR) * 1.0 },
    { channel: "g" as const, range: (highG - lowG) * 1.2 },
    { channel: "b" as const, range: (highB - lowB) * 0.8 },
  ]
  return spread.sort((a, b) => b.range - a.range)[0]
}

/**
 * Median cut: split the box holding the most pixels along its widest channel,
 * at the point half its pixels lie either side, until there are as many boxes
 * as the palette has room for.
 */
function cut(buckets: Bucket[], maxColors: number): Box[] {
  let boxes: Box[] = [
    { buckets, count: buckets.reduce((total, bucket) => total + bucket.count, 0) },
  ]
  while (boxes.length < maxColors) {
    // Only a box with something to split is a candidate; a box holding one
    // colour is finished however many pixels it has.
    const candidates = boxes.filter((box) => box.buckets.length > 1)
    if (candidates.length === 0) break
    const target = candidates.reduce((best, box) => (box.count > best.count ? box : best))
    const { channel } = widest(target)
    const sorted = [...target.buckets].sort(
      (a, b) => a[channel] / a.count - b[channel] / b.count,
    )
    const half = target.count / 2
    let running = 0
    let split = 0
    while (split < sorted.length - 1 && running + sorted[split].count <= half) {
      running += sorted[split].count
      split += 1
    }
    if (split === 0) split = 1
    const left = sorted.slice(0, split)
    const right = sorted.slice(split)
    const total = (list: Bucket[]) => list.reduce((sum, bucket) => sum + bucket.count, 0)
    boxes = boxes.filter((box) => box !== target)
    boxes.push({ buckets: left, count: total(left) }, { buckets: right, count: total(right) })
  }
  return boxes
}

/**
 * RGBA pixels to a palette and an index per pixel. `maxColors` is the whole
 * table; a frame with transparency spends one slot of it on the hole.
 */
export function quantize(
  data: Uint8ClampedArray | Uint8Array,
  maxColors = 256,
  alphaThreshold = 127,
): Quantized {
  const pixels = data.length / 4
  const histogram = new Map<number, Bucket>()
  let translucent = false
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4
    if (data[offset + 3] <= alphaThreshold) {
      translucent = true
      continue
    }
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const id = key(r, g, b)
    const bucket = histogram.get(id)
    if (bucket) {
      bucket.count += 1
      bucket.r += r
      bucket.g += g
      bucket.b += b
    } else {
      histogram.set(id, { count: 1, r, g, b, key: id })
    }
  }

  const transparent = translucent ? 0 : null
  const room = Math.max(1, maxColors - (translucent ? 1 : 0))
  const boxes = cut([...histogram.values()], room)
  const colours: number[][] = boxes
    .filter((box) => box.count > 0)
    .map((box) => {
      let count = 0
      let r = 0
      let g = 0
      let b = 0
      for (const bucket of box.buckets) {
        count += bucket.count
        r += bucket.r
        g += bucket.g
        b += bucket.b
      }
      return count === 0
        ? [0, 0, 0]
        : [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
    })
  if (colours.length === 0) colours.push([0, 0, 0])

  // The transparent slot goes first so its index is a constant: the writer
  // names index 0 in the graphic control extension.
  const table = translucent ? [[0, 0, 0], ...colours] : colours
  const palette = new Uint8Array(table.length * 3)
  table.forEach((colour, index) => {
    palette[index * 3] = colour[0]
    palette[index * 3 + 1] = colour[1]
    palette[index * 3 + 2] = colour[2]
  })

  const first = translucent ? 1 : 0
  const cache = new Map<number, number>()
  const nearest = (r: number, g: number, b: number) => {
    const id = key(r, g, b)
    const hit = cache.get(id)
    if (hit !== undefined) return hit
    let best = first
    let bestDistance = Infinity
    for (let index = first; index < table.length; index += 1) {
      const dr = r - table[index][0]
      const dg = g - table[index][1]
      const db = b - table[index][2]
      const distance = dr * dr * 1.0 + dg * dg * 1.2 + db * db * 0.8
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    cache.set(id, best)
    return best
  }

  const indices = new Uint8Array(pixels)
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4
    if (data[offset + 3] <= alphaThreshold) {
      indices[index] = 0
      continue
    }
    indices[index] = nearest(data[offset], data[offset + 1], data[offset + 2])
  }

  return { palette, indices, transparent }
}

/** LZW as GIF specifies it: LSB-first codes, a reset when the dictionary fills. */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize
  const end = clear + 1
  const out: number[] = []
  let bits = 0
  let held = 0
  let codeSize = minCodeSize + 1
  let next = end + 1
  let dictionary = new Map<number, number>()

  const emit = (code: number) => {
    held |= code << bits
    bits += codeSize
    while (bits >= 8) {
      out.push(held & 0xff)
      held >>= 8
      bits -= 8
    }
  }

  emit(clear)
  let prefix = indices.length > 0 ? indices[0] : -1
  for (let index = 1; index < indices.length; index += 1) {
    const char = indices[index]
    const pair = (prefix << 8) | char
    const known = dictionary.get(pair)
    if (known !== undefined) {
      prefix = known
      continue
    }
    emit(prefix)
    if (next < 4096) {
      dictionary.set(pair, next)
      next += 1
      // Grow the code only once the dictionary genuinely needs the extra bit.
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize += 1
    } else {
      emit(clear)
      dictionary = new Map()
      codeSize = minCodeSize + 1
      next = end + 1
    }
    prefix = char
  }
  if (prefix !== -1) emit(prefix)
  emit(end)
  if (bits > 0) out.push(held & 0xff)
  return Uint8Array.from(out)
}

/** A growable byte sink, because a GIF's length is not known until it is written. */
class Bytes {
  private data = new Uint8Array(1024)
  private length = 0

  push(...values: number[]) {
    this.reserve(values.length)
    for (const value of values) {
      this.data[this.length] = value
      this.length += 1
    }
  }

  short(value: number) {
    this.push(value & 0xff, (value >> 8) & 0xff)
  }

  bytes(values: Uint8Array) {
    this.reserve(values.length)
    this.data.set(values, this.length)
    this.length += values.length
  }

  ascii(text: string) {
    this.push(...[...text].map((character) => character.charCodeAt(0)))
  }

  /** LZW output rides in blocks of at most 255 bytes, each with its length. */
  blocks(values: Uint8Array) {
    for (let start = 0; start < values.length; start += 255) {
      const chunk = values.subarray(start, Math.min(start + 255, values.length))
      this.push(chunk.length)
      this.bytes(chunk)
    }
    this.push(0)
  }

  private reserve(extra: number) {
    if (this.length + extra <= this.data.length) return
    let size = this.data.length * 2
    while (size < this.length + extra) size *= 2
    const grown = new Uint8Array(size)
    grown.set(this.data.subarray(0, this.length))
    this.data = grown
  }

  done() {
    return this.data.slice(0, this.length)
  }
}

/** The smallest table size the format allows for this many colours: a power of two, at least 4. */
const tableBits = (colours: number) => {
  let bits = 2
  while (1 << bits < colours) bits += 1
  return Math.min(8, bits)
}

/**
 * Frames to a GIF89a file. Every frame is full-size and carries its own colour
 * table; a frame with transparency disposes to the background so the next one
 * does not show through the hole.
 */
export function encodeGif(frames: GifFrame[], options: GifOptions): Uint8Array {
  const { width, height, loop = 0, alphaThreshold = 127 } = options
  if (frames.length === 0) throw new Error("a GIF needs at least one frame")
  const out = new Bytes()

  out.ascii("GIF89a")
  out.short(width)
  out.short(height)
  // No global colour table: 0x70 is "8 bits of colour resolution, no GCT".
  out.push(0x70, 0, 0)

  // NETSCAPE 2.0 — the de facto looping extension.
  out.push(0x21, 0xff, 0x0b)
  out.ascii("NETSCAPE2.0")
  out.push(0x03, 0x01)
  out.short(loop)
  out.push(0)

  for (const frame of frames) {
    const { palette, indices, transparent } = quantize(frame.data, 256, alphaThreshold)
    const colours = palette.length / 3
    const bits = tableBits(colours)
    const slots = 1 << bits

    // Disposal 2 — restore to background — is the only way a transparent frame
    // can replace rather than layer over the one before it.
    const disposal = transparent === null ? 1 : 2
    out.push(0x21, 0xf9, 0x04)
    out.push((disposal << 2) | (transparent === null ? 0 : 1))
    out.short(centiseconds(frame.delay))
    out.push(transparent ?? 0, 0)

    out.push(0x2c)
    out.short(0)
    out.short(0)
    out.short(width)
    out.short(height)
    out.push(0x80 | (bits - 1))

    const table = new Uint8Array(slots * 3)
    table.set(palette.subarray(0, Math.min(palette.length, table.length)))
    out.bytes(table)

    const minCodeSize = Math.max(2, bits)
    out.push(minCodeSize)
    out.blocks(lzwEncode(indices, minCodeSize))
  }

  out.push(0x3b)
  return out.done()
}
