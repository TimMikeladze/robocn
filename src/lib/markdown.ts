/**
 * The docs site, as Markdown.
 *
 * robocn's readers are disproportionately coding agents — the product is
 * "install this source into your project" — and an agent that can only see the
 * hydrated HTML does the worst version of that job. So every docs page has a
 * `.md` mirror, `/llms.txt` indexes them, and both are built from the same
 * `DocEntry` the HTML page renders, so the two cannot drift.
 *
 * Reasoning and the routing: `docs/site-polish.md`.
 */

import { docGroups, docs, type DocEntry, type PropRow } from "@/lib/docs"
import { defaultManager, installCommand, itemUrl, site } from "@/lib/site"

/**
 * The note every mirrored page carries, so an agent that lands on one page can
 * find the rest without being told. Same purpose as the `sr-only` copy of it in
 * the docs layout.
 */
export function agentNote(host: string) {
  return `> For the complete index, see [llms.txt](${host}/llms.txt). A Markdown version of any page is available by appending \`.md\` to its URL or by sending an \`Accept: text/markdown\` header.`
}

/** A Markdown table, or nothing at all when there are no rows to put in one. */
function propsTable(rows: PropRow[] | undefined, heading: string) {
  if (!rows?.length) return []
  const body = rows.map(
    (row) =>
      `| \`${row.name}\` | \`${row.type}\` | ${row.default ? `\`${row.default}\`` : "—"} | ${row.description} |`,
  )
  return [
    `## ${heading}`,
    "",
    "| name | type | default | description |",
    "| --- | --- | --- | --- |",
    ...body,
    "",
  ]
}

/**
 * One docs page as Markdown. `host` is passed rather than read from `site` so a
 * mirror served off a preview deployment prints its own origin in the install
 * line, the same argument as `productionUrl` on the social card.
 */
export function entryMarkdown(entry: DocEntry, host: string) {
  const lines = [`# ${entry.title}`, "", entry.summary, "", agentNote(host), ""]

  if (entry.item) {
    lines.push(
      "## Install",
      "",
      "```bash",
      installCommand(entry.item, defaultManager, host),
      "```",
      "",
      `Registry item: \`${entry.item}\` · [\`${itemUrl(entry.item, host)}\`](${itemUrl(entry.item, host)})`,
      "",
    )
  }

  if (entry.notes?.length) {
    lines.push(
      `## ${entry.item ? "Notes" : "How it works"}`,
      "",
      ...entry.notes.map((note) => `- ${note}`),
      "",
    )
  }

  if (entry.usage) {
    lines.push("## Usage", "", "```tsx", entry.usage.trim(), "```", "")
  }

  lines.push(...propsTable(entry.props, "Props"))
  lines.push(...propsTable(entry.api, "API"))

  if (entry.files.length) {
    lines.push(
      "## Source",
      "",
      ...entry.files.map((file) => `- \`src/${file}\``),
      "",
    )
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`
}

/** The docs index page as Markdown: the catalogue, grouped the way the site groups it. */
export function indexMarkdown(host: string) {
  const items = docs.filter((entry) => entry.item)
  const lines = [
    "# Components",
    "",
    `${items.length} installable components, libraries and hooks for robotic interfaces.`,
    "",
    agentNote(host),
    "",
  ]

  for (const group of docGroups) {
    const inGroup = docs.filter((entry) => entry.group === group)
    if (!inGroup.length) continue
    lines.push(`## ${group}`, "")
    for (const entry of inGroup) {
      lines.push(`- [${entry.title}](${host}/docs/${entry.slug}.md): ${entry.summary}`)
    }
    lines.push("")
  }

  return `${lines.join("\n").trimEnd()}\n`
}

/**
 * `/llms.txt`: the whole site in one file an agent can read before it browses.
 * The shape follows the llmstxt.org convention — H1, a blockquote blurb, then
 * link sections — because that is what the crawlers reading it expect.
 */
export function llmsTxt(host: string) {
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description} Every page below is also available as Markdown at the same URL with \`.md\` appended, or by sending an \`Accept: text/markdown\` header.`,
    "",
    "## Site",
    "",
    `- [Components](${host}/docs.md): The full catalogue, grouped by kind.`,
    `- [Installation](${host}/docs/installation.md): How the shadcn registry install works, and the \`@robocn\` namespace.`,
    `- [Workbench](${host}/workbench): Every machine with its controls, in the browser.`,
    `- [About](${host}/about): Why robocn exists, and what is solved rather than animated.`,
    "",
  ]

  for (const group of docGroups) {
    const inGroup = docs.filter((entry) => entry.group === group)
    if (!inGroup.length) continue
    lines.push(`## ${group}`, "")
    for (const entry of inGroup) {
      lines.push(`- [${entry.title}](${host}/docs/${entry.slug}.md): ${entry.summary}`)
    }
    lines.push("")
  }

  lines.push(
    "## Registry",
    "",
    `- [registry.json](${host}/r/registry.json): The shadcn registry index.`,
    `- Item endpoint: \`${host}/r/{name}.json\` — e.g. \`${itemUrl("robot-arm", host)}\`.`,
    `- Namespace: add \`"@robocn": "${host}/r/{name}.json"\` to \`components.json\` and install by short name.`,
    "",
  )

  return `${lines.join("\n").trimEnd()}\n`
}
