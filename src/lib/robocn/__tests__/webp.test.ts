import { describe, expect, it } from "vitest"

import { frameSize, hasAlpha, imageChunks, muxAnimatedWebp, readChunks } from "@/lib/robocn/webp"

const ascii = (bytes: Uint8Array, at: number, length = 4) =>
  String.fromCharCode(...bytes.subarray(at, at + length))

const u32 = (bytes: Uint8Array, at: number) =>
  bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)

const u24 = (bytes: Uint8Array, at: number) =>
  bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)

/** A single-image WebP the shape `canvas.toBlob("image/webp")` returns. */
function fakeWebp(
  chunks: { fourcc: string; data: number[] }[],
): Uint8Array {
  const body: number[] = []
  for (const chunk of chunks) {
    body.push(...[...chunk.fourcc].map((character) => character.charCodeAt(0)))
    const size = chunk.data.length
    body.push(size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff)
    body.push(...chunk.data)
    if (size % 2 === 1) body.push(0)
  }
  const header = [
    ...[..."RIFF"].map((c) => c.charCodeAt(0)),
    (body.length + 4) & 0xff,
    ((body.length + 4) >> 8) & 0xff,
    ((body.length + 4) >> 16) & 0xff,
    ((body.length + 4) >> 24) & 0xff,
    ...[..."WEBP"].map((c) => c.charCodeAt(0)),
  ]
  return Uint8Array.from([...header, ...body])
}

/** A lossy bitstream header: the three-byte frame tag, the start code, 14-bit dimensions. */
const vp8 = (width: number, height: number) => [
  0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a,
  width & 0xff, (width >> 8) & 0x3f,
  height & 0xff, (height >> 8) & 0x3f,
  0x00, 0x00,
]

describe("reading a WebP", () => {
  it("lists the chunks with the container gone", () => {
    const chunks = readChunks(fakeWebp([{ fourcc: "VP8 ", data: vp8(64, 32) }]))
    expect(chunks.map((chunk) => chunk.fourcc)).toEqual(["VP8 "])
    expect(chunks[0].data.length).toBe(12)
  })

  it("steps over the pad byte an odd chunk carries", () => {
    const chunks = readChunks(
      fakeWebp([
        { fourcc: "ALPH", data: [1, 2, 3] },
        { fourcc: "VP8 ", data: vp8(8, 8) },
      ]),
    )
    expect(chunks.map((chunk) => chunk.fourcc)).toEqual(["ALPH", "VP8 "])
    expect([...chunks[0].data]).toEqual([1, 2, 3])
  })

  it("refuses anything that is not a WebP", () => {
    expect(() => readChunks(Uint8Array.from([1, 2, 3, 4]))).toThrow(/not a WebP/)
  })

  it("reads the frame's own dimensions out of the bitstream", () => {
    expect(frameSize(readChunks(fakeWebp([{ fourcc: "VP8 ", data: vp8(320, 240) }])))).toEqual({
      width: 320,
      height: 240,
    })
  })

  it("knows a frame that carries alpha from one that does not", () => {
    expect(hasAlpha(readChunks(fakeWebp([{ fourcc: "VP8 ", data: vp8(4, 4) }])))).toBe(false)
    expect(
      hasAlpha(
        readChunks(
          fakeWebp([
            { fourcc: "ALPH", data: [0] },
            { fourcc: "VP8 ", data: vp8(4, 4) },
          ]),
        ),
      ),
    ).toBe(true)
  })
})

describe("muxing an animation", () => {
  const frames = [
    { data: fakeWebp([{ fourcc: "VP8 ", data: vp8(4, 4) }]), delay: 66 },
    { data: fakeWebp([{ fourcc: "VP8 ", data: vp8(4, 4) }]), delay: 100 },
  ]

  it("writes a RIFF whose declared size matches the file", () => {
    const file = muxAnimatedWebp(frames, { width: 4, height: 4 })
    expect(ascii(file, 0)).toBe("RIFF")
    expect(ascii(file, 8)).toBe("WEBP")
    expect(u32(file, 4)).toBe(file.length - 8)
  })

  it("declares the canvas and the animation flag in VP8X", () => {
    const file = muxAnimatedWebp(frames, { width: 300, height: 200 })
    expect(ascii(file, 12)).toBe("VP8X")
    expect(u32(file, 16)).toBe(10)
    expect(file[20] & 0x02).toBe(0x02)
    expect(file[20] & 0x10).toBe(0) // no frame carries alpha
    expect(u24(file, 24) + 1).toBe(300)
    expect(u24(file, 27) + 1).toBe(200)
  })

  it("raises the alpha flag when a frame has one", () => {
    const file = muxAnimatedWebp(
      [
        {
          data: fakeWebp([
            { fourcc: "ALPH", data: [0, 0] },
            { fourcc: "VP8 ", data: vp8(4, 4) },
          ]),
          delay: 40,
        },
      ],
      { width: 4, height: 4 },
    )
    expect(file[20] & 0x10).toBe(0x10)
  })

  it("writes the loop count into ANIM", () => {
    const file = muxAnimatedWebp(frames, { width: 4, height: 4, loop: 3 })
    const anim = file.indexOf("A".charCodeAt(0), 30)
    expect(ascii(file, anim)).toBe("ANIM")
    expect(file[anim + 8 + 4] | (file[anim + 8 + 5] << 8)).toBe(3)
  })

  it("gives every frame an ANMF carrying its own duration and payload", () => {
    const file = muxAnimatedWebp(frames, { width: 4, height: 4 })
    const found: { duration: number; payload: string[] }[] = []
    for (let at = 0; at < file.length - 8; at += 1) {
      if (ascii(file, at) !== "ANMF") continue
      const size = u32(file, at + 4)
      const body = file.subarray(at + 8, at + 8 + size)
      found.push({
        duration: u24(body, 12),
        payload: readChunks(
          Uint8Array.from([
            ...[..."RIFF"].map((c) => c.charCodeAt(0)),
            0, 0, 0, 0,
            ...[..."WEBP"].map((c) => c.charCodeAt(0)),
            ...body.subarray(16),
          ]),
        ).map((chunk) => chunk.fourcc),
      })
    }
    expect(found.length).toBe(2)
    expect(found.map((frame) => frame.duration)).toEqual([66, 100])
    // Blending off, disposal none: every frame is a whole picture.
    expect(found.every((frame) => frame.payload[0] === "VP8 ")).toBe(true)
  })

  it("hoists the colour profile out of the frames, where it corrupts the file", () => {
    // Chrome writes an ICCP into every WebP it encodes. It is a file-level
    // chunk: left inside ANMF, libwebp rejects the whole animation.
    const withProfile = fakeWebp([
      { fourcc: "ICCP", data: [1, 2, 3, 4] },
      { fourcc: "VP8 ", data: vp8(4, 4) },
    ])
    expect(imageChunks(readChunks(withProfile)).map((chunk) => chunk.fourcc)).toEqual(["VP8 "])

    const file = muxAnimatedWebp([{ data: withProfile, delay: 40 }], { width: 4, height: 4 })
    expect(file[20] & 0x20).toBe(0x20)
    const order: string[] = []
    let at = 12
    while (at + 8 <= file.length) {
      order.push(ascii(file, at))
      const size = u32(file, at + 4)
      if (order.at(-1) === "ANMF") {
        expect(ascii(file, at + 24)).not.toBe("ICCP")
      }
      at += 8 + size + (size % 2)
    }
    expect(order).toEqual(["VP8X", "ICCP", "ANIM", "ANMF"])
  })

  it("refuses an animation with no frames and one with no canvas", () => {
    expect(() => muxAnimatedWebp([], { width: 4, height: 4 })).toThrow(/at least one frame/)
    expect(() => muxAnimatedWebp(frames, { width: 0, height: 4 })).toThrow(/canvas/)
  })
})
