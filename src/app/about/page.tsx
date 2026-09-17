import Link from "next/link"

import { HeroArm } from "@/components/site/hero-arm"
import { InstallCommand } from "@/components/site/install-command"
import { Panel } from "@/components/site/panel"
import { Button } from "@/components/ui/button"
import { docGroups, docs } from "@/lib/docs"
import { groupBlurbs } from "@/lib/groups"
import { ogSize, siteOgImage } from "@/lib/og"
import { rail } from "@/components/site/rail"
import { site } from "@/lib/site"
import { cn } from "@/lib/utils"

const description =
  "Why robocn exists, what is actually solved rather than animated, how the components are themed and sized, and who builds it."

const images = [
  {
    url: siteOgImage,
    ...ogSize,
    alt: `${site.name} — twelve robot components on a contact sheet beside the wordmark`,
  },
]

export const metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About — ${site.name}`,
    description,
    url: `${site.url}/about`,
    type: "article",
    images,
  },
  twitter: { card: "summary_large_image", images },
}

/** Counted rather than typed out, so the page cannot go stale against the registry. */
const installable = docs.filter((entry) => entry.item)

const byGroup = docGroups.map((group) => ({
  group,
  count: installable.filter((entry) => entry.group === group).length,
}))

/** One row of the answer to "what is in it", built from the registry itself. */
function GroupTable() {
  return (
    <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
      {byGroup.map(({ group, count }) => (
        <div key={group} className="bg-panel px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-medium">{group}</h3>
            <span className="font-mono text-[13px] text-muted-foreground tabular-nums">
              {count}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {groupBlurbs[group]}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function AboutPage() {
  return (
    <div className={cn(rail, "py-12 md:py-16")}>
      <article className="max-w-3xl space-y-12">
        <header className="space-y-4">
          <p className="font-mono text-[12px] tracking-wide text-muted-foreground">About</p>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight">
            Machines, not pictures of machines
          </h1>
          <p className="text-[16px] leading-relaxed text-muted-foreground">
            robocn is a{" "}
            <a
              href="https://ui.shadcn.com/docs/registry"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              shadcn registry
            </a>{" "}
            of {installable.length} robot components. They install as source into your
            project, the way shadcn/ui components do — you own them, edit them, and theme
            them with CSS variables.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Why it exists</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            shadcn/ui covers forms and layout. Nothing covered <em>machines</em> — the arm
            on a robotics landing page, the pick-and-place loader on a fabrication
            dashboard, the face on a support bot. Those normally arrive as a looping GIF, a
            Lottie file, or a hand-keyframed SVG: fixed at one size, one palette, one pose,
            and unable to answer a question the page asks it.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            A machine that solves its own geometry answers instead. Give it a target and it
            reaches; give it a value and it shows that value. It is a component, not an
            asset.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">What is actually solved</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            The distinction that matters here is between a pose that was computed and a pose
            somebody drew. Every claim below is arithmetic running in the browser at 60fps,
            in a solver with no dependencies at all.
          </p>
          <ul className="space-y-3 text-[14.5px] leading-relaxed text-muted-foreground">
            <li className="border-l border-border pl-4">
              <span className="text-foreground">Inverse kinematics.</span> Two links close
              with the law of cosines; longer chains run FABRIK, seeded with the previous
              frame so the arm never snaps between two valid solutions. A target out of
              reach stretches toward it rather than breaking the pose.
            </li>
            <li className="border-l border-border pl-4">
              <span className="text-foreground">One solve, two renderers.</span> The SVG arm
              and the react-three-fiber arm run the same kinematics core, so the same target
              puts the tip in the same place in 2D and in 3D.
            </li>
            <li className="border-l border-border pl-4">
              <span className="text-foreground">The mechanisms underneath.</span> A gearbox
              turns at its real ratio, a fan brake retards as k·ω², a crop unit&apos;s
              florets are placed by the golden angle over equal areas of its own surface.
              When a machine here looks like it is doing something, it is doing it.
            </li>
            <li className="border-l border-border pl-4">
              <span className="text-foreground">Even the logo.</span> The mark in the header
              is a three-link chain solved by the same hook the components use. Click
              anywhere and it re-aims at where you clicked.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">What is in it</h2>
          <GroupTable />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">How you control one</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Four colour roles resolve prop first, then CSS variable, then a built-in
            default, so setting{" "}
            <code className="font-mono text-[13.5px] text-foreground">--robot-shell</code>{" "}
            once repaints every machine on the page.{" "}
            <code className="font-mono text-[13.5px] text-foreground">variant</code> changes
            how a machine is painted and never where its joints are — blueprint adds the
            grid, the dimensions and the joint angles, because a drawing is what you want
            when you are explaining a mechanism rather than selling one. Size is a prop, and{" "}
            <code className="font-mono text-[13.5px] text-foreground">interactive</code>{" "}
            turns a machine into a control you can drag or arrow-key. Reduced-motion
            settings park all of it.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button size="sm" nativeButton={false} render={<Link href="/workbench" />}>
              Try it in the workbench
            </Button>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/docs" />}
            >
              Browse all {installable.length}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">How it is built</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            One Next.js app is both the documentation site and the registry itself. Every
            file listed in{" "}
            <code className="font-mono text-[13.5px] text-foreground">registry.json</code>{" "}
            lives at the path a consumer installs it to, so what this site renders is
            exactly what ships — there is no build step between the demo and the download,
            and a broken component breaks the page you are reading.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            A large share of the people installing from here are coding agents, so the site
            is written for them too: every page has a{" "}
            <a href="/docs/robot-arm.md" className="text-foreground underline underline-offset-4">
              Markdown mirror
            </a>{" "}
            and the whole catalogue is one file at{" "}
            <a href="/llms.txt" className="text-foreground underline underline-offset-4">
              /llms.txt
            </a>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Install one</h2>
          <InstallCommand item="robot-arm" />
          <Panel className="p-4">
            <HeroArm />
          </Panel>
        </section>

        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-xl font-semibold tracking-tight">Who</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Built by{" "}
            <a
              href={site.author.portfolio}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              {site.author.name}
            </a>
            . MIT licensed, and the source is on{" "}
            <a
              href={site.repository}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              GitHub
            </a>{" "}
            — issues and new machines both welcome.
          </p>
        </section>
      </article>
    </div>
  )
}
