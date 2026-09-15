import Link from "next/link"

import { docs } from "@/lib/docs"
import { defaultManager, shadcnRunner } from "@/lib/site"

/**
 * The landing page's "so what do I do with it" section.
 *
 * It replaced a four-cell statistics strip — 207 items, 0 dependencies, 8 end
 * effectors, 2D + 3D — which was a generic SaaS stat bar on a site whose whole
 * visual language is engineering drawings, and which told a visitor nothing
 * they could act on. The numbers worth keeping are folded into the prose below;
 * the rest of the space now answers the four questions the strip did not:
 * how do I use one, how do I build one, what skills ship with this, and what
 * does an agent get.
 *
 * Notes: `docs/landing-how-it-works.md`.
 */

const installable = docs.filter((entry) => entry.item).length

/**
 * The skills in `skills/`, from their own SKILL.md front matter, shortened to a
 * line each. A test asserts these names are exactly the directories on disk.
 */
const landingSkills = [
  { name: "build-robot", purpose: "A new machine, end to end — from a reference photo if you have one." },
  { name: "refine-robot", purpose: "Change a machine that already ships: a new axis, a new view, a fix." },
  { name: "fork-robot", purpose: "Set up a fork and get to the point of building in it." },
  { name: "publish-robot", purpose: "Take a finished machine to a pull request back here." },
] as const

const steps = [
  {
    n: "01",
    title: "Install one",
    href: "/docs",
    link: "Browse the catalogue",
    body: (
      <>
        {installable} registry items — machines, solvers and hooks — each installed as
        source the way a shadcn/ui component is. No package to depend on and nothing to
        import from: the files land in your project and you own them from then on. Register
        the <code className="font-mono text-[12.5px]">@robocn</code> namespace once and
        every item installs by short name.
      </>
    ),
    code: `${shadcnRunner(defaultManager)} shadcn@latest add @robocn/robot-arm`,
  },
  {
    n: "02",
    title: "Drive it",
    href: "/docs/robot-arm",
    link: "Read the props",
    body: (
      <>
        Give a machine a target and it reaches; give it a value and it shows that value;
        give it nothing and it runs its own cycle. The pose is solved every frame in a core
        with no dependencies at all, so the same target puts the tip in the same place in
        SVG and in WebGL.
      </>
    ),
    code: `<RobotArm target={{ x, y }} interactive />`,
  },
  {
    n: "03",
    title: "Build a new one",
    href: "/workbench",
    link: "Open the workbench",
    body: (
      <>
        The workbench is a Storybook for robots that runs on this repository&apos;s own
        source. Controls are derived from each component&apos;s props by the TypeScript AST
        rather than written by hand, matrix mode draws a whole cross product at once, and{" "}
        <span className="text-foreground">New</span> scaffolds a machine and writes the
        brief for whoever builds it.
      </>
    ),
    code: `pnpm dev  →  /workbench  →  New`,
  },
] as const

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 space-y-6 py-14">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">What this is, and what to do with it</h2>
        <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">
          robocn is a shadcn registry of machines rather than a component library of
          pictures. Every item solves its own geometry in the browser, themes itself from
          your CSS variables, and installs into your project as source you can edit. The
          same repository is the documentation site, the registry, the workbench you build
          new machines in, and the skills an agent follows to build them for you.
        </p>
      </div>

      <div className="grid gap-px border border-border bg-border lg:grid-cols-3">
        {steps.map((step) => (
          <div key={step.n} className="flex flex-col gap-3 bg-panel px-5 py-5">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {step.n}
              </span>
              <h3 className="text-[15px] font-medium">{step.title}</h3>
            </div>
            <p className="flex-1 text-[13.5px] leading-relaxed text-muted-foreground">
              {step.body}
            </p>
            {/* The line, not a picture of the line: every panel ends on something
                a reader can actually type. */}
            <code className="block border-l border-border pl-3 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
              {step.code}
            </code>
            <Link
              href={step.href}
              className="text-[12.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {step.link} →
            </Link>
          </div>
        ))}
      </div>

      <div className="grid gap-px border border-border bg-border lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 bg-panel px-5 py-5">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">04</span>
            <h3 className="text-[15px] font-medium">Or let an agent build it</h3>
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            Four skills ship from this repository and install anywhere the{" "}
            <code className="font-mono text-[12.5px]">skills</code> CLI runs. They carry the
            contract a machine has to keep — solved pose, four camera angles, self-running
            motion, registry entry, tests — so an agent starts from the rules rather than
            from a catalogue of two hundred components.
          </p>
          <code className="block border-l border-border pl-3 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
            bunx skills add TimMikeladze/robocn
          </code>
          <dl className="space-y-2 pt-1">
            {landingSkills.map((skill) => (
              <div key={skill.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-mono text-[12px] text-foreground sm:w-28">
                  {skill.name}
                </dt>
                <dd className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {skill.purpose}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-3 bg-panel px-5 py-5">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">05</span>
            <h3 className="text-[15px] font-medium">Everything here is readable as text</h3>
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            A large share of the people installing from here are agents, so the site does not
            make them parse a hydration payload. Every documentation page has a Markdown
            mirror at the same URL with{" "}
            <code className="font-mono text-[12.5px]">.md</code> appended — or behind an{" "}
            <code className="font-mono text-[12.5px]">Accept: text/markdown</code> header —
            carrying the install line, the props table and the source list as plain text. The
            whole catalogue is one file.
          </p>
          <code className="block border-l border-border pl-3 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
            {`curl robocn.dev/llms.txt
curl robocn.dev/docs/robot-arm.md`}
          </code>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            Each page also has a <span className="text-foreground">Copy page</span> action
            that puts its Markdown on your clipboard or hands the URL straight to an
            assistant.
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-[12.5px]">
            <a
              href="/llms.txt"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              llms.txt →
            </a>
            <Link
              href="/about"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              What robocn is →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export { HowItWorks, landingSkills }
