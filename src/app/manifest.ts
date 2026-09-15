/**
 * The installable-app manifest. `background_color` is the light ground and
 * `theme_color` the same, because the splash a browser paints from this has no
 * way to ask which scheme the visitor is in — the `themeColor` viewport entry
 * in the root layout is the one that follows the palette.
 */

import type { MetadataRoute } from "next"

import { site } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} — ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f6",
    theme_color: "#f2f4f6",
    categories: ["developer", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
