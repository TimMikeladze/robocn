/**
 * Umami, when there is an Umami to report to.
 *
 * A cookieless page-view counter: no identifier is stored on the visitor's
 * machine, which is why the site carries no consent banner. The script is only
 * emitted when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set, so a clone, a fork and
 * every `pnpm dev` without a `.env.local` serve the site with no third-party
 * script in it at all.
 *
 * Written up in `docs/analytics.md`.
 */

import Script from "next/script"

export interface UmamiConfig {
  /** The full URL of the tracker script, not its host. */
  src: string
  websiteId: string
}

/** Umami Cloud, for an instance that has not been self-hosted. */
const CLOUD = "https://cloud.umami.is/script.js"

/**
 * The decision, as a pure function of the two variables: an id is what turns
 * analytics on, and the URL only says where the script comes from. Blank strings
 * count as unset — an empty Vercel environment variable is someone turning it
 * off, not a request to load `undefined`.
 */
export function umamiConfig(websiteId?: string, url?: string): UmamiConfig | null {
  const id = websiteId?.trim()
  if (!id) return null
  return { src: url?.trim() || CLOUD, websiteId: id }
}

export function Analytics() {
  // Read as literal member expressions, because that is the form Next inlines
  // at build time.
  const config = umamiConfig(
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    process.env.NEXT_PUBLIC_UMAMI_URL,
  )
  if (!config) return null
  // The counter is not worth a millisecond of the first paint: the machines on
  // this page are solving chains in that time.
  return (
    <Script src={config.src} data-website-id={config.websiteId} strategy="afterInteractive" />
  )
}
