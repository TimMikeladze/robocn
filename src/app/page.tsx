import Link from "next/link"

import { Catalogue, type CatalogueCard } from "@/components/site/catalogue"
import { HeroArm } from "@/components/site/hero-arm"
import { InstallCommand } from "@/components/site/install-command"
import { Panel } from "@/components/site/panel"
import { VariantStrip } from "@/components/site/variant-strip"
import { Button } from "@/components/ui/button"
import { docGroups, docs } from "@/lib/docs"

/**
 * Only what a card needs. The props tables in `docs.ts` stay on the server.
 *
 * `docs` is the registry joined onto the written pages, so this is every
 * installable item — including one that shipped this morning and has no page
 * written for it yet. `summary` is what its card line falls back to.
 */
const cards: CatalogueCard[] = docGroups.flatMap((group) =>
  docs
    .filter((entry) => entry.item && entry.group === group)
    .map(({ slug, title, summary }) => ({ slug, title, group, summary })),
)

const facts = [
  { value: String(cards.length), label: "registry items" },
  { value: "0", label: "dependencies in the solver" },
  { value: "8", label: "end effectors" },
  { value: "2D + 3D", label: "same kinematics" },
]

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="grid items-center gap-8 py-12 md:grid-cols-[1fr_1fr] md:py-20">
        <div className="space-y-6">
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Robot components for shadcn/ui
          </h1>
          <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
            Arms, cells and machines that solve their own kinematics in the
            browser. Install the source into your project, theme it with CSS
            variables, and set its size with a prop.
          </p>
          <InstallCommand item="robot-arm" className="max-w-lg" />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" nativeButton={false} render={<Link href="/docs" />}>
              Browse components
            </Button>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/docs/installation" />}
            >
              How installing works
            </Button>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/workbench" />}>
              Open the workbench ↗
            </Button>
          </div>
        </div>
        <Panel className="p-4">
          <HeroArm />
        </Panel>
      </section>

      <section className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-panel px-4 py-5">
            <div className="font-mono text-2xl">{fact.value}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{fact.label}</div>
          </div>
        ))}
      </section>

      {/* Anchored: the docs link here, and `pnpm shots` scrolls to it. */}
      <section id="catalogue" className="scroll-mt-20 space-y-4 py-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Every machine</h2>
          <Link
            href="/docs"
            className="text-[13px] text-muted-foreground hover:text-foreground"
          >
            Search and filter
          </Link>
        </div>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          All {cards.length} registry items, including the solvers and hooks
          underneath them. Foundations are drawn as blueprints, because what you
          install there is the maths, not the machine.
        </p>
        <Catalogue entries={cards} />
      </section>

      <section id="variants" className="scroll-mt-20 space-y-4 pb-14">
        <h2 className="text-2xl font-semibold tracking-tight">Four ways to draw one</h2>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          <code className="font-mono text-[13.5px]">variant</code> changes how a
          machine is painted, never where its joints are. Blueprint adds the
          grid, the dimensions and the joint angles, because a drawing is what
          you want when you are explaining a mechanism rather than selling one.
        </p>
        <VariantStrip />
      </section>

      <section className="grid gap-6 border-t border-border py-14 md:grid-cols-3">
        <div>
          <h3 className="text-[15px] font-medium">Kinematics, not keyframes</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Two links solve with the law of cosines; longer chains run FABRIK,
            seeded with the previous frame. Out-of-reach targets stretch toward
            the target instead of breaking the pose.
          </p>
        </div>
        <div>
          <h3 className="text-[15px] font-medium">Themed like the rest of your UI</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Four colour roles resolve prop first, then CSS variable, then a
            built-in default. Set{" "}
            <code className="font-mono text-[13px]">--robot-shell</code> once and
            every machine on the page follows.
          </p>
        </div>
        <div>
          <h3 className="text-[15px] font-medium">Moving, and worth grabbing</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Every machine runs its own cycle until you supply its value, and{" "}
            <code className="font-mono text-[13px]">interactive</code> turns one
            into a control you can drag or arrow-key. Let go and it eases back
            into the cycle. Reduced-motion settings park all of it.
          </p>
        </div>
      </section>
    </div>
  )
}
