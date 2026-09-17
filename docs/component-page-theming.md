# Theming controls on a component page

Every component page carries the machine's whole palette, not just its shape and motion
knobs. The demo panel's controls are hand-written per item and stop at variant, view and
behaviour; the colours were only reachable in the workbench or by editing the source.

## What it is

A palette strip under the demo on every `/docs/<item>` page with a live demo: one well per
robot colour role — `shell`, `metal`, `dark`, `accent`, `glow`, `grid`, `foreground` —
plus reset and a copy button that hands back the CSS.

## How it works

Nothing per item, and no edit to the 6,000 lines of hand-written demos. Every machine
paints through `defaultRobotPalette` in `src/lib/robocn/style.ts`, where each role reads
its own CSS variable:

```ts
shell: "var(--robot-shell, oklch(0.72 0.17 47))"
```

So setting `--robot-shell` retints every robot below it. The strip writes the seven
variables as inline style on `<html>` — `:root` itself, exactly the CSS the copy button
hands back. What you tune here is what you paste.

It goes on the root rather than on a wrapper around the demo because the WebGL machines
(`robot-arm-3d`, `robot-stage`) cannot read a wrapper: three.js needs a resolved colour,
so they probe the document for the variable's value and re-read when `<html>` changes,
which is what `watchCssColors` watches. A wrapper would move every SVG machine and leave
those two behind.

Inline style on the root outranks the site theme's stylesheet, so the gear menu's palette
is the floor and this is the override. A role that is left alone is not written at all, so
it keeps following the theme and the light/dark mode; clearing one hands it straight back,
and so does leaving the page.

## Where it lives

```
src/components/site/demo-theming.tsx   the strip, the wrapper, the CSS block
src/components/site/demo-panel.tsx     wraps every docs demo in it
src/lib/robocn/style.ts                the roles and their variables (unchanged)
src/lib/robocn/color.ts                oklch → hex for the colour inputs (unchanged)
```

## Notes

- Props still win over variables: a demo that passes `color="oklch(…)"` — the robot arm's
  colour switch, say — paints that role from the prop, and the well for it does nothing
  until the demo is back on `default`. That is the component's own precedence, not the
  strip's.
- `<input type="color">` is sRGB hex, so a well shows the nearest hex of an oklch token
  and writes hex back. The text field beside it takes any CSS colour, including `oklch(…)`,
  for people who want the wide-gamut value.
