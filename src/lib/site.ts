/**
 * The public host, whatever machine happens to be serving. The social card
 * prints this rather than `siteUrl`, so a card captured from a dev server does
 * not ship an install line pointing at localhost.
 */
export const productionUrl = "https://robocn.dev"

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
  /** One sentence, and short enough to survive a search result. */
  description:
    "A shadcn registry of robot components: arms, droids, walking animals and build cells that solve their own kinematics in the browser. Install the source, theme it with CSS variables.",
  url: siteUrl,
  repository: "https://github.com/TimMikeladze/robocn",
  /**
   * Search and social keywords. Also the source for the GitHub repo topics —
   * `gh repo edit --add-topic` takes the same list, lowercased and hyphenated.
   */
  keywords: [
    "shadcn",
    "shadcn/ui",
    "shadcn registry",
    "react components",
    "robot components",
    "robotics",
    "kinematics",
    "inverse kinematics",
    "robot arm",
    "SVG animation",
    "react-three-fiber",
    "Next.js",
    "Tailwind CSS",
    "TypeScript",
  ],
  author: {
    name: "Tim Mikeladze",
    linkedin: "https://www.linkedin.com/in/tim-mikeladze",
    portfolio: "https://linesofcode.dev",
    twitter: "https://twitter.com/linesofcode",
  },
} as const

/** The URL a consumer installs an item from. */
export const itemUrl = (name: string, host = siteUrl) => `${host}/r/${name}.json`

export const installCommand = (name: string, manager = "pnpm", host = siteUrl) => {
  const runner: Record<string, string> = {
    pnpm: "pnpm dlx",
    npm: "npx",
    yarn: "yarn dlx",
    bun: "bunx --bun",
  }
  return `${runner[manager] ?? "npx"} shadcn@latest add ${itemUrl(name, host)}`
}
