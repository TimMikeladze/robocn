/**
 * An ICO container, because nothing else writes one.
 *
 * `favicon.ico` is the icon a browser fetches when it has not read the page —
 * a bare `/favicon.ico` hit, a bookmark bar, a history entry, a feed reader —
 * so it cannot be the SVG, and sharp has no `.ico` encoder. The format is small
 * enough to write by hand: a 6-byte header, one 16-byte directory entry per
 * size, then the images back to back. PNG payloads are the modern form and are
 * read by every browser since IE 11, which is also the only way to keep the
 * cell's translucent orange and the rounded corners.
 *
 * Used by `scripts/build-icons.mjs`; the mark it packs is `docs/logo.md`.
 */

const HEADER = 6
const ENTRY = 16

/**
 * @param {{ size: number, data: Buffer }[]} images — square PNGs, one per size.
 * @returns {Buffer} the `.ico` file.
 */
export function packIco(images) {
  if (images.length === 0) throw new Error("an ICO needs at least one image")

  const header = Buffer.alloc(HEADER)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon, 2 = cursor
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(ENTRY * images.length)
  let offset = HEADER + directory.length

  images.forEach(({ size, data }, i) => {
    if (size < 1 || size > 256) throw new Error(`ICO sizes run 1…256, not ${size}`)
    const at = i * ENTRY
    // 256 is written as 0: the field is one byte and the format says so.
    directory.writeUInt8(size === 256 ? 0 : size, at)
    directory.writeUInt8(size === 256 ? 0 : size, at + 1)
    directory.writeUInt8(0, at + 2) // palette size — 0 for truecolour
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}
