"use client"

/**
 * How to actually use this thing.
 *
 * The workbench has no agent in it, which means the loop it is built for — pose
 * a machine here, hand the brief to Claude Code or Codex in the same checkout,
 * watch Fast Refresh land the edit — is invisible unless somebody says it. This
 * is where it is said: clone, install, run, connect, iterate.
 *
 * Opens by itself the first time, and never again once dismissed.
 */

import * as React from "react"

import { Command, WorkbenchDialog } from "@/components/workbench/dialog"
import { site } from "@/lib/site"

export const SETUP_SEEN_KEY = "robocn-workbench-setup"

/** The agent CLIs this loop is written for. Any editor with a repo works. */
const agents = [
  { command: "claude", label: "Claude Code", href: "https://claude.com/claude-code" },
  { command: "codex", label: "Codex CLI", href: "https://developers.openai.com/codex/cli" },
  { command: "opencode", label: "opencode", href: "https://opencode.ai" },
]

const clone = `git clone ${site.repository}.git
cd robocn
pnpm install
pnpm dev`

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-2">
      <span className="mt-0.5 flex size-6 items-center justify-center rounded-full border border-border font-mono text-[11px]">
        {n}
      </span>
      <div className="min-w-0 space-y-2">
        <h3 className="text-[13px] font-medium">{title}</h3>
        {children}
      </div>
    </section>
  )
}

export interface SetupGuideProps {
  onClose: () => void
  /** True where the page is served from the visitor's own machine. */
  local: boolean
}

function SetupGuide({ onClose, local }: SetupGuideProps) {
  return (
    <WorkbenchDialog
      eyebrow={local ? "Running locally" : "Run this on your own machine"}
      title="The loop: a pose here, an agent there, Fast Refresh between them."
      onClose={onClose}
    >
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            There is no agent inside this page — no key to paste, nothing to connect, nothing
            sent anywhere. The machines on the stage are the real modules in{" "}
            <code className="font-mono text-[12px] text-foreground">src/components/ui</code>.
            Edit one — by hand, or with the coding agent you already pay for — and the stage
            redraws through Fast Refresh without a reload and without losing the pose.
            {local ? null : (
              <>
                {" "}
                <strong className="text-foreground">
                  On robocn.dev you can drive every control, but nothing here can edit files.
                </strong>{" "}
                For the loop itself, run it locally:
              </>
            )}
          </p>

          <Step n={1} title="Clone it and start the dev server">
            <Command code={clone} label="terminal" />
            <p className="text-[12px] text-muted-foreground">
              Then open{" "}
              <code className="font-mono text-foreground">http://localhost:3000/workbench</code>.
              Needs Node 20+ and pnpm. Port taken? Next picks the next free one and prints it.
            </p>
          </Step>

          <Step n={2} title="Open your agent in the same directory">
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => (
                <a
                  key={agent.command}
                  href={agent.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:bg-accent"
                >
                  {agent.command}
                  <span className="ml-1.5 text-muted-foreground">{agent.label}</span>
                </a>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground">
              A second terminal in the same checkout — that is the whole integration. The repo
              ships an <code className="font-mono text-foreground">AGENTS.md</code> and a{" "}
              <code className="font-mono text-foreground">build-robot</code> skill, so an agent
              opened here already knows the house rules for building a machine.
            </p>
          </Step>

          <Step n={3} title="Pose the machine, then hand over the brief">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Pick a component on the left and turn the knobs on the right — they are derived
              from that component&rsquo;s own props, so there is nothing to wire up. Open{" "}
              <strong className="text-foreground">Handoff</strong> and copy the prompt: it names
              the file, the export and the exact pose on screen. Paste it into your agent with
              what you want changed.
            </p>
            <Command
              code={`Edit \`src/components/ui/robot-arm.tsx\` in robocn — the \`RobotArm\` component.
<RobotArm variant="blueprint" view="iso" />
Give the gripper a third finger, and keep the iso view honest.`}
              label="what the handoff writes"
            />
          </Step>

          <Step n={4} title="Watch it land">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              The agent edits the file, saves, and the stage redraws in place — the status bar
              says <span className="font-mono">rendered just now</span>. Keep this page on a
              second screen and iterate. A broken save shows the error on the stage instead of
              taking the page down; the next save clears it.
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Add or rename a <em>prop</em> and the knob for it appears after{" "}
              <code className="font-mono text-foreground">pnpm generate</code> — the control
              manifest is a build step, the component itself is live.
            </p>
          </Step>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="font-mono text-[11px] text-muted-foreground">
              ? reopens this · / search · m matrix · s handoff
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-border bg-foreground px-3 py-1.5 font-mono text-[11px] text-background transition-opacity hover:opacity-90"
            >
              Start posing
            </button>
          </div>
    </WorkbenchDialog>
  )
}

export { SetupGuide, agents }
