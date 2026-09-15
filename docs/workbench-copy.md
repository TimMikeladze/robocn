# Workbench copy

The workbench's dialogs explain a tool nobody has used before: a page that renders the
repository's own components, a coding agent in a second terminal, and an optional folder the
page can read and write. The explanations were the weakest part of it. They were written in
a voice that reached for a metaphor before it reached for a fact, and a first-time reader
finished the setup panel without knowing what to type.

This is the rewrite, and the rule it follows.

## The voice

Same voice as this project's READMEs. Plainly:

- **State what a thing does, then what you do with it.** "The Source tab is an editor over
  the real file. ⌘S writes it." Not "Source is the small one."
- **Instructions are second person and imperative.** "Clone the repository and start the dev
  server." Headings are the task, not a slogan.
- **No metaphor, no personification, no rhetorical inversion.** The workbench does not
  "hold" a folder in the copy, a draft is not "a machine that does not exist yet", and
  nothing "is said here". A folder is open. A file exists.
- **One idea per sentence.** Em dashes carrying a second clause become a full stop. Where a
  dash survives it separates a label from a value.
- **Name the real thing.** File paths, prop names, commands and keys in code font, exactly
  as typed: `src/components/ui/<item>.tsx`, `pnpm generate`, `⌘S`.
- **`Note:` for the aside** that does not belong in the instruction.

## What changed

| Where | Was | Now |
|---|---|---|
| `setup-guide.tsx` | "The loop: a pose here, an agent there, Fast Refresh between them." | "Getting started", five numbered steps: clone, agent, pose and hand off, watch it land, open a folder. |
| `new-robot.tsx` | "Name it, and the workbench writes the file." | "Create a component" / "Write the brief for a new component", depending on whether a folder is open. |
| `source-panel.tsx` | "This one is still a draft." | "This component is a draft." Panel intro says where the prompt goes and what happens on save. |
| `checkout-button.tsx` | "Holding robocn — 312 files watched" | "robocn · 312 files watched". Tooltips say what opening a folder allows. |
| `poses.tsx` | "A pose kept here stays in this browser." | "Saved poses stay in this browser. Nothing is uploaded." |
| `workbench.tsx` | "Start a new machine (n)", "How to run this and connect your agent (?)" | "New component (n)", "Getting started (?)". |
| `controls.ts` | "I am looking at it in the workbench, posed like this:" | "The component is posed like this in the workbench:" |

The setup panel gained the step it was missing. Opening a folder is the one feature that
changes what the page can do — the Source tab becomes an editor, `New` writes the file,
registry items install into another project — and it was explained nowhere except a tooltip.

## Verification

`src/components/workbench/__tests__/workbench.test.tsx` asserts the dialogs by their
accessible names, so it moves with the titles. It keeps checking what the panels are for
rather than how they are phrased: the setup panel opens once and names every agent CLI with
its command, and the new-component brief names the file, the export and the component to
follow.
