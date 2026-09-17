import Link from "next/link"
import { Boxes, GitBranch, Globe, Images, MessagesSquare, Palette, ShieldCheck, Users } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { rail } from "@/components/site/rail"
import { eyebrow } from "@/components/studio/styles"
import { MachineView } from "@/components/studio/machine-view"
import type { Pose } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Boxes,
    title: "Design on the real machine",
    body: "Every registry component, every prop on a knob — derived from the component's own types, so a new prop is a new control the day it ships.",
  },
  {
    icon: GitBranch,
    title: "Versions, not autosave",
    body: "A version is a decision: numbered, noted, snapshotted, immutable. Diff any two, load one back onto the stage, restore it as the newest.",
  },
  {
    icon: MessagesSquare,
    title: "Review where the work is",
    body: "Threads pinned to the version they were written on, resolved when they are done, and review stages your organization names itself.",
  },
  {
    icon: Globe,
    title: "Publish, embed, fork",
    body: "Freeze a version at a public URL with the JSX and the install line, drop it in an iframe, read it as JSON — or let someone fork it.",
  },
  {
    icon: Images,
    title: "A real asset library",
    body: "Folders, tags, search, bulk moves, trash with restore, replace-in-place, public links and “where is this used”. Exports land there too.",
  },
  {
    icon: Palette,
    title: "Your palette on any machine",
    body: "Brand palettes are the six robocn colour roles. Define one once; apply it to an arm, a rover or a jellyfish in a click.",
  },
  {
    icon: Users,
    title: "Organizations and roles",
    body: "Owners, admins, editors and viewers. Invite by link, belong to as many organizations as you like, switch without signing out.",
  },
  {
    icon: ShieldCheck,
    title: "Tenancy is a column",
    body: "Every row carries its organization and every query starts with it. Private review links expire; revoked ones stop working.",
  },
]

/** One machine twice, two ways each: the point is that a design is the props, not the component. */
const showcase: { id: string; pose: Pose }[] = [
  { id: "robot-arm", pose: { behavior: "sweep" } },
  { id: "robot-arm", pose: { behavior: "sweep", variant: "blueprint", color: "#3b82f6", accent: "#f59e0b" } },
  { id: "robot-face", pose: { color: "#10b981" } },
  { id: "robot-face", pose: { variant: "outline" } },
]

/** What `/studio` is to someone who has not signed in. */
function StudioLanding() {
  return (
    <div className="pb-20">
      <section className="border-b border-border bg-panel">
        <div className={cn(rail, "grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:py-20")}>
          <div>
            <p className={eyebrow}>robocn Studio</p>
            <h1 className="mt-2 max-w-xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
              Where a team decides what the machine looks like.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Pose, theme, version, review and publish robocn machines together — and keep every reference
              image, export and brief beside the design it belongs to.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/studio/sign-up" className={buttonVariants({ size: "lg" })}>
                Create an account
              </Link>
              <Link href="/studio/sign-in" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Sign in
              </Link>
              <Link href="/explore" className={buttonVariants({ size: "lg", variant: "ghost" })}>
                See what is published →
              </Link>
            </div>
          </div>
          <div className="datum-frame grid grid-cols-2 border border-border bg-background">
            {showcase.map((cell, index) => (
              <div
                key={index}
                className="flex aspect-square items-center justify-center overflow-hidden border-border p-3 odd:border-r [&:nth-child(-n+2)]:border-b"
              >
                <MachineView componentId={cell.id} pose={cell.pose} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(rail, "pt-12")}>
        <p className={eyebrow}>What is in it</p>
        <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-background p-5">
              <Icon className="size-4 text-muted-foreground" />
              <h2 className="mt-3 text-[14px] font-medium">{title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export { StudioLanding }
