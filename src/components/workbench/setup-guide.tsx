"use client"

/**
 * How to run the workbench and connect an agent to it.
 *
 * The page contains no agent, so the loop it is built for — pose a component
 * here, hand the brief to Claude Code or Codex in the same checkout, let Fast
 * Refresh land the edit — has to be written down somewhere. This is it: clone,
 * run, connect, pose, and the optional folder.
 *
 * Opens by itself on a first visit, and never again once dismissed. Voice and
 * rewrite notes: `docs/workbench-copy.md`.
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
      eyebrow={local ? "Running locally" : "Running on robocn.dev"}
      title="Getting started"
      onClose={onClose}
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        The workbench renders the real components from{" "}
        <code className="font-mono text-[12px] text-foreground">src/components/ui</code>. There
        is no agent in this page, no API key to paste and no sandbox compiler. You edit a
        component in your own checkout, by hand or with a coding agent, and the dev server puts
        the change on the stage through Fast Refresh. No reload, and the pose is kept.
        {local ? null : (
          <>
            {" "}
            <strong className="text-foreground">
              Every control works on robocn.dev, but a hosted page cannot rebuild your
              components.
            </strong>{" "}
            Run it on your own machine to edit them.
          </>
        )}
      </p>

      <Step n={1} title="Clone the repository and start the dev server">
        <Command code={clone} label="terminal" />
        <p className="text-[12px] text-muted-foreground">
          Requires Node 20+ and pnpm. Then open{" "}
          <code className="font-mono text-foreground">http://localhost:3000/workbench</code>. If
          port 3000 is taken, Next starts on the next free port and prints the URL.
        </p>
      </Step>

      <Step n={2} title="Open a coding agent in the same directory">
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
          A second terminal in the same checkout is the whole integration. There is nothing to
          connect and no key to store. The agent edits{" "}
          <code className="font-mono text-foreground">src/components/ui/&lt;item&gt;.tsx</code>{" "}
          and the running dev server does the rest. The repository ships an{" "}
          <code className="font-mono text-foreground">AGENTS.md</code> and a{" "}
          <code className="font-mono text-foreground">build-robot</code> skill, so an agent
          started here already has the project&rsquo;s conventions.
        </p>
      </Step>

      <Step n={3} title="Pose a component, then hand over the brief">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Pick a component in the index on the left and set its props with the controls on the
          right. The controls are generated from each component&rsquo;s own props, so there is
          nothing to wire up. Open{" "}
          <strong className="text-foreground">Handoff</strong> and copy the prompt. It names the
          file, the export and the pose on screen. Add what you want changed and paste it into
          the agent.
        </p>
        <Command
          code={`Edit \`src/components/ui/robot-arm.tsx\` in robocn — the \`RobotArm\` component.
<RobotArm variant="blueprint" view="iso" />
Give the gripper a third finger, and keep the iso view honest.`}
          label="what handoff writes"
        />
      </Step>

      <Step n={4} title="Watch the edit land">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          The agent saves the file and the stage redraws in place. The status bar reads{" "}
          <span className="font-mono">rendered just now</span>. Keep the page on a second screen
          and iterate. A save that does not compile shows the error on the stage instead of
          taking the page down, and the next save clears it.
        </p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Note: adding or renaming a prop adds its control after{" "}
          <code className="font-mono text-foreground">pnpm generate</code>. The control manifest
          is a build step; the component itself is live.
        </p>
      </Step>

      <Step n={5} title="Open a folder to read and write files from this page">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Optional, and only in Chrome, Edge and Opera on a desktop. Click{" "}
          <strong className="text-foreground">Folder</strong> in the toolbar and pick this
          checkout, the directory containing{" "}
          <code className="font-mono text-foreground">registry.json</code>. The page then reads
          and writes it directly: the Source tab becomes an editor with ⌘S,{" "}
          <strong className="text-foreground">New</strong> writes the component file itself, a
          recording can be saved into{" "}
          <code className="font-mono text-foreground">docs/screenshots</code>, and a component
          created since the page loaded is picked up without a restart.
        </p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          A folder does not replace the dev server. The browser writes the file; only{" "}
          <code className="font-mono text-foreground">pnpm dev</code> rebuilds the module the
          stage is drawing.
        </p>
      </Step>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="font-mono text-[11px] text-muted-foreground">
          ? reopens this · / search · m matrix · s handoff · n new
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-border bg-foreground px-3 py-1.5 font-mono text-[11px] text-background transition-opacity hover:opacity-90"
        >
          Open the workbench
        </button>
      </div>
    </WorkbenchDialog>
  )
}

export { SetupGuide, agents }
