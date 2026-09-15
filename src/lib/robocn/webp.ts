/**
 * Animated WebP without an encoder.
 *
 * There is no `VideoEncoder` for WebP and no VP8 encoder worth shipping in
 * TypeScript — but every browser already has one behind
 * `canvas.toBlob("image/webp")`, which returns a complete single-image WebP
 * file. An animated WebP is exactly those files' payload chunks re-housed in
 * frame headers, so this module never touches a pixel: it reads each file's
 * chunk list, drops the container, and re-emits the chunks inside `ANMF`.
 *
 * Container: RIFF, `VP8X` (canvas size + flags), `ANIM` (background, loop),
 * then one `ANMF` a frame. Notes: `docs/export.md`.
 */

/** A RIFF chunk: a four-character code and its payload, unpadded. */
export interface WebpChunk {
  fourcc: string
  data: Uint8Array
}

/** One frame: a whole single-image WebP file, and how long it stays up. */
export interface WebpFrame {
  data: Uint8Array
  /** Milliseconds; WebP stores them directly, to 24 bits. */
  delay: number
}

export interface WebpOptions {
  width: number
  height: number
  /** Repeat count; 0 — the default — is forever. */
  loop?: number
  /** Canvas background as RGBA bytes. Transparent by default. */
  background?: [number, number, number, number]
}

const ascii = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])

const readU32 = (bytes: Uint8Array, at: number) =>
  bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24 >>> 0)

/**
 * The chunks of a WebP file, in order, with the 12-byte RIFF header gone.
 * Throws on anything that is not a WebP, because the alternative is muxing
 * rubbish into a file that fails silently in an image viewer.
 */
export function readChunks(file: Uint8Array): WebpChunk[] {
  if (file.length < 12 || ascii(file, 0) !== "RIFF" || ascii(file, 8) !== "WEBP") {
    throw new Error("not a WebP file")
  }
  const chunks: WebpChunk[] = []
  let at = 12
  while (at + 8 <= file.length) {
    const fourcc = ascii(file, at)
    const size = readU32(file, at + 4)
    const start = at + 8
    if (start + size > file.length) break
    chunks.push({ fourcc, data: file.subarray(start, start + size) })
    // Every chunk is padded to an even length; the pad byte is not its data.
    at = start + size + (size % 2)
  }
  return chunks
}

/** A frame's own dimensions, read out of the bitstream header it carries. */
export function frameSize(chunks: WebpChunk[]): { width: number; height: number } | null {
  const lossy = chunks.find((chunk) => chunk.fourcc === "VP8 ")
  if (lossy && lossy.data.length >= 10) {
    const data = lossy.data
    // 3-byte frame tag, then the start code, then 14-bit width and height.
    if (data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
      return {
        width: (data[6] | (data[7] << 8)) & 0x3fff,
        height: (data[8] | (data[9] << 8)) & 0x3fff,
      }
    }
  }
  const lossless = chunks.find((chunk) => chunk.fourcc === "VP8L")
  if (lossless && lossless.data.length >= 5 && lossless.data[0] === 0x2f) {
    const bits =
      lossless.data[1] | (lossless.data[2] << 8) | (lossless.data[3] << 16) | (lossless.data[4] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  return null
}

/** Whether a frame carries alpha: a lossless bitstream, or a lossy one with `ALPH`. */
export const hasAlpha = (chunks: WebpChunk[]) =>
  chunks.some((chunk) => chunk.fourcc === "ALPH" || chunk.fourcc === "VP8L")

/**
 * The chunks that are the picture itself, and may live inside a frame.
 *
 * Everything else a single-image file carries is document-level furniture. A
 * colour profile in particular is a file-level chunk: Chrome writes an `ICCP`
 * into every WebP it encodes, and copying those into the frames produces a file
 * libwebp rejects outright as a corrupt header.
 */
export const imageChunks = (chunks: WebpChunk[]) =>
  chunks.filter(
    (chunk) => chunk.fourcc === "ALPH" || chunk.fourcc === "VP8 " || chunk.fourcc === "VP8L",
  )

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

  /** 24-bit little-endian: what WebP uses for sizes, offsets and durations. */
  u24(value: number) {
    this.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff)
  }

  u32(value: number) {
    this.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff)
  }

  ascii(text: string) {
    this.push(...[...text].map((character) => character.charCodeAt(0)))
  }

  bytes(values: Uint8Array) {
    this.reserve(values.length)
    this.data.set(values, this.length)
    this.length += values.length
  }

  get size() {
    return this.length
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

const chunk = (out: Bytes, fourcc: string, payload: Uint8Array) => {
  out.ascii(fourcc)
  out.u32(payload.length)
  out.bytes(payload)
  if (payload.length % 2 === 1) out.push(0)
}

/**
 * Single-image WebP files to one animated WebP.
 *
 * Every frame covers the whole canvas and replaces what is under it — blending
 * off, disposal none — which is what a recording of a moving drawing wants: no
 * frame is a delta, so a seek lands on a complete picture.
 */
export function muxAnimatedWebp(frames: WebpFrame[], options: WebpOptions): Uint8Array {
  const { width, height, loop = 0, background = [0, 0, 0, 0] } = options
  if (frames.length === 0) throw new Error("an animation needs at least one frame")
  if (width < 1 || height < 1) throw new Error("an animation needs a canvas")

  const files = frames.map((frame) => ({
    delay: Math.max(0, Math.round(frame.delay)),
    chunks: readChunks(frame.data),
  }))
  const parsed = files.map((frame) => ({ delay: frame.delay, chunks: imageChunks(frame.chunks) }))
  // One colour profile for the animation, taken from the frames — they all came
  // out of the same encoder, so the first one that has it speaks for all.
  const profile = files
    .flatMap((frame) => frame.chunks)
    .find((entry) => entry.fourcc === "ICCP")

  const body = new Bytes()

  const vp8x = new Bytes()
  // Flags, high bit first: reserved, reserved, ICC, alpha, EXIF, XMP, animation.
  vp8x.push(
    0x02 |
      (parsed.some((frame) => hasAlpha(frame.chunks)) ? 0x10 : 0) |
      (profile ? 0x20 : 0),
  )
  vp8x.u24(0)
  vp8x.u24(width - 1)
  vp8x.u24(height - 1)
  chunk(body, "VP8X", vp8x.done())

  // Order is the format's, not a preference: VP8X, then ICCP, then ANIM.
  if (profile) chunk(body, "ICCP", profile.data)

  const anim = new Bytes()
  // The background is BGRA in the file, whatever order it arrived in here.
  anim.push(background[2], background[1], background[0], background[3])
  anim.push(loop & 0xff, (loop >> 8) & 0xff)
  chunk(body, "ANIM", anim.done())

  for (const frame of parsed) {
    const payload = new Bytes()
    payload.u24(0)
    payload.u24(0)
    payload.u24(width - 1)
    payload.u24(height - 1)
    payload.u24(frame.delay)
    // Bit 1 set: do not blend, overwrite. Bit 0 clear: do not dispose.
    payload.push(0x02)
    for (const entry of frame.chunks) chunk(payload, entry.fourcc, entry.data)
    chunk(body, "ANMF", payload.done())
  }

  const file = new Bytes()
  file.ascii("RIFF")
  file.u32(body.size + 4)
  file.ascii("WEBP")
  file.bytes(body.done())
  return file.done()
}
