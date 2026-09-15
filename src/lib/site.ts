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

/**
 * How each package manager runs a one-off binary, and the order the install
 * block offers them in. `bun` leads and is the default: it is the fastest of
 * the four at the thing this line actually does — fetch `shadcn` and run it
 * once — and a visitor on another manager is one tab away.
 *
 * One list, so the tabs on the site, the line on the social card and the line
 * in the Markdown mirrors cannot disagree about which manager came first.
 */
export const packageManagers = ["bun", "pnpm", "npm", "yarn"] as const

export type PackageManager = (typeof packageManagers)[number]

export const defaultManager: PackageManager = packageManagers[0]

const runner: Record<PackageManager, string> = {
  bun: "bunx --bun",
  pnpm: "pnpm dlx",
  npm: "npx",
  yarn: "yarn dlx",
}

/** How a one-off `shadcn` invocation starts, in `manager`. */
export const shadcnRunner = (manager: string) =>
  runner[manager as PackageManager] ?? runner.npm

export const installCommand = (
  name: string,
  manager: string = defaultManager,
  host = siteUrl,
) => `${shadcnRunner(manager)} shadcn@latest add ${itemUrl(name, host)}`
