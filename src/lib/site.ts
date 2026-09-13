/** Where this registry lives. Set NEXT_PUBLIC_REGISTRY_URL per environment. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_REGISTRY_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "")

export const site = {
  name: "robocn",
  tagline: "Robots for shadcn/ui",
  description:
    "A shadcn-compatible registry of robot components: articulated arms in SVG and WebGL, SCARA, delta and gantry machines, faces and loaders. Copy the source, theme it with CSS variables, size it with a prop.",
  url: siteUrl,
  repository: "https://github.com/TimMikeladze/robocn",
} as const

/** The URL a consumer installs an item from. */
export const itemUrl = (name: string) => `${siteUrl}/r/${name}.json`

export const installCommand = (name: string, manager = "pnpm") => {
  const runner: Record<string, string> = {
    pnpm: "pnpm dlx",
    npm: "npx",
    yarn: "yarn dlx",
    bun: "bunx --bun",
  }
  return `${runner[manager] ?? "npx"} shadcn@latest add ${itemUrl(name)}`
}
