/** Ids, slugs and tokens. Pure, so both the server and the tests can use them. */

import { customAlphabet } from "nanoid"

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
const short = customAlphabet(alphabet, 12)
const tiny = customAlphabet(alphabet, 6)
const long = customAlphabet(alphabet + "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 32)

/** `dsn_4f9k…` — the prefix makes a stray id in a log say what it is. */
export const newId = (prefix: string) => `${prefix}_${short()}`

/** Unguessable, for share links: 32 characters of base 62 is ~190 bits. */
export const newToken = () => long()

export const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "")

/** Path segments Studio or the site already owns under `/studio/` and `/o/`. */
export const reservedSlugs = new Set([
  "sign-in",
  "sign-up",
  "onboarding",
  "invite",
  "account",
  "new",
  "api",
  "settings",
  "admin",
  "explore",
])

export const isValidSlug = (slug: string) =>
  /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug) && !reservedSlugs.has(slug)

/** A slug with a random tail: for public URLs, where a collision is someone else's design. */
export const uniqueSlug = (name: string) => `${slugify(name) || "design"}-${tiny()}`

/**
 * The first free slug in a namespace: `arm`, `arm-2`, `arm-3`. `taken` is asked
 * rather than told so the caller can make it a query.
 */
export async function freeSlug(name: string, taken: (slug: string) => Promise<boolean>) {
  const base = slugify(name) || "untitled"
  const safe = reservedSlugs.has(base) ? `${base}-1` : base
  if (!(await taken(safe))) return safe
  for (let n = 2; n < 200; n++) {
    const candidate = `${safe}-${n}`
    if (!(await taken(candidate))) return candidate
  }
  return `${safe}-${tiny()}`
}
