# The install line

One line is the thing almost every visitor actually copies, and it is printed in
five places: the hero, every docs page, both social cards, the Markdown mirrors,
and the README. They used to decide independently which package manager to lead
with, which is how the social card and the site could have disagreed.

They now all read `packageManagers` from `src/lib/site.ts`. That list is the tab
order *and* the default, and `shadcnRunner` is the only place that knows how each
manager runs a one-off binary.

```ts
export const packageManagers = ["bun", "pnpm", "npm", "yarn"] as const
export const defaultManager = packageManagers[0]
```

## Why bun leads

The line does exactly one thing — fetch `shadcn` and run it once — and `bunx` is
the fastest of the four at that. Nothing about robocn requires Bun; a visitor on
another manager is one tab away, and the tabs are in the block precisely so that
choosing a default costs nobody anything.

## Why `bunx --bun` and not plain `bunx`

`bunx` honours the package's own `#!/usr/bin/env node` shebang, so it shells out
to Node to run `shadcn`. `--bun` overrides that and runs it in Bun's runtime.

The difference only shows up on a machine with Bun and no Node, where plain
`bunx` fails and `bunx --bun` works. That is a real audience — and it is the same
argument the folder installer makes on every docs page ("no CLI, no node"), so
the two should not contradict each other. It is also the line shadcn's own
documentation prints, which matters for something people paste from memory.

## The repository itself is still pnpm

`packageManager` in `package.json`, `pnpm-lock.yaml`, and every `pnpm …` in
`scripts/` are the project's own toolchain and are unrelated to what the site
recommends to a consumer. Changing one does not imply changing the other.

## Tests

`src/lib/__tests__/site.test.ts` pins the order, the default, each runner, and
the npx fallback for a manager nobody has heard of. The two social-card tests
assert the rendered line, so a change here fails there until `pnpm og` is re-run.
