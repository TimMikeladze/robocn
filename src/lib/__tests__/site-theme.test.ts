import { describe, expect, it } from "vitest"

import {
  applyTheme,
  defaultThemeChoice,
  formatThemeCss,
  hexToOklch,
  oklchToHex,
  randomTune,
  readThemeChoice,
  roleSpec,
  themeBootScript,
  themeCss,
  themeData,
  themePresets,
  tuneFromHex,
} from "@/lib/site-theme"

const decl = (css: string, name: string, block: "light" | "dark") => {
  const [lightBlock, darkBlock] = css.split(":root:root.dark{")
  const source = block === "light" ? lightBlock : darkBlock
  return source.match(new RegExp(`${name}:(oklch\\([^)]*\\)|[^;}]*)`))?.[1] ?? null
}

describe("theme ladder", () => {
  it("reproduces the shipped globals.css values on the default preset", () => {
    const css = themeCss(themeData, "steel", 0.625)
    // The four that globals.css pins by hand — if the ladder drifts, the site
    // changes colour on first paint.
    expect(decl(css, "--background", "light")).toBe("oklch(0.966 0.003 240)")
    expect(decl(css, "--signal", "light")).toBe("oklch(0.56 0.11 176)")
    expect(decl(css, "--robot-shell", "light")).toBe("oklch(0.72 0.17 47)")
    expect(decl(css, "--background", "dark")).toBe("oklch(0.175 0.012 252)")
    expect(decl(css, "--shell-hot", "dark")).toBe("oklch(0.82 0.19 56)")
  })

  it("rotates a role's hue without touching lightness", () => {
    const steel = themeCss(themeData, "steel", 0.625)
    const cobalt = themeCss(themeData, "cobalt", 0.625)
    // signal 176 -> 62 on the same L and C.
    expect(decl(steel, "--signal", "light")).toBe("oklch(0.56 0.11 176)")
    expect(decl(cobalt, "--signal", "light")).toBe("oklch(0.56 0.11 62)")
  })

  it("drops every role to zero chroma for mono, robots included", () => {
    const css = themeCss(themeData, "mono", 0.625)
    for (const name of ["--signal", "--robot-shell", "--background", "--shell"]) {
      expect(decl(css, name, "light")).toMatch(/oklch\([\d.]+ 0 \d+\)/)
    }
  })

  it("ships both registers, and only the light one carries the radius", () => {
    const css = themeCss(themeData, "steel", 1)
    expect(css).toContain(":root:root:not(.dark){")
    expect(css).toContain(":root:root.dark{")
    expect(css.match(/--radius:1rem/g)).toHaveLength(1)
  })

  it("falls back to the first preset for an id that no longer exists", () => {
    expect(themeCss(themeData, "gone", 0.625)).toBe(themeCss(themeData, "steel", 0.625))
  })

  it("keeps every preset id unique", () => {
    expect(new Set(themePresets.map((p) => p.id)).size).toBe(themePresets.length)
  })
})

describe("stored choice", () => {
  it("takes only the two fields it owns", () => {
    expect(readThemeChoice('{"preset":"rust","radius":0}', themeData)).toEqual({
      preset: "rust",
      radius: 0,
    })
  })

  it("falls back on missing, malformed, or wrongly typed storage", () => {
    expect(readThemeChoice(null, themeData)).toEqual(defaultThemeChoice)
    expect(readThemeChoice("not json", themeData)).toEqual(defaultThemeChoice)
    expect(readThemeChoice('{"preset":7,"radius":"big"}', themeData)).toEqual(
      defaultThemeChoice,
    )
  })
})

describe("pre-paint script", () => {
  it("carries the generator itself rather than a second copy of it", () => {
    const script = themeBootScript()
    expect(script).toContain("themeCss")
    expect(script).toContain(themeData.storageKey)
    // The ladder travels compact; expanded CSS for every preset would not.
    expect(script.length).toBeLessThan(12000)
  })

  it("runs, and writes the saved theme into one style element", () => {
    window.localStorage.setItem("robocn-theme", '{"preset":"plasma","radius":0}')
    // `eval` is the point of the test: the serialised script has to be valid,
    // self-contained JavaScript.
    eval(themeBootScript())
    const el = document.getElementById("robocn-theme")
    expect(el?.textContent).toBe(themeCss(themeData, "plasma", 0))

    // A second run reuses the element instead of stacking stylesheets.
    eval(themeBootScript())
    expect(document.querySelectorAll("#robocn-theme")).toHaveLength(1)
    window.localStorage.clear()
  })

  it("survives storage that throws", () => {
    const get = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error("blocked")
    }
    expect(() => eval(themeBootScript())).not.toThrow()
    Storage.prototype.getItem = get
  })
})

describe("applyTheme", () => {
  it("replaces the stylesheet in place", () => {
    document.getElementById("robocn-theme")?.remove()
    applyTheme(themeCss, themeData, { preset: "rust", radius: 1 })
    applyTheme(themeCss, themeData, { preset: "mono", radius: 0 })
    const els = document.querySelectorAll("#robocn-theme")
    expect(els).toHaveLength(1)
    expect(els[0].textContent).toBe(themeCss(themeData, "mono", 0))
  })
})

describe("formatThemeCss", () => {
  it("breaks the one-liner into pasteable blocks", () => {
    const pretty = formatThemeCss(themeCss(themeData, "steel", 0.625))
    expect(pretty).toContain(":root:root:not(.dark) {\n  --background:")
    expect(pretty).toContain("\n}")
    expect(pretty.split("\n").length).toBeGreaterThan(40)
  })
})

describe("tuned roles", () => {
  const steel = themePresets.filter((p) => p.id === "steel")[0]

  it("replaces only the tuned role and leaves the rest of the preset alone", () => {
    const css = themeCss(themeData, "steel", 0.625, { shell: { hue: 300, chroma: 0.5 } })
    // shell moved: --robot-shell sits at +1° from the role hue, chroma halved.
    expect(decl(css, "--robot-shell", "light")).toBe("oklch(0.72 0.085 301)")
    // signal untouched.
    expect(decl(css, "--signal", "light")).toBe("oklch(0.56 0.11 176)")
  })

  it("is byte-for-byte the preset when no role is tuned", () => {
    expect(themeCss(themeData, "cobalt", 1, {})).toBe(themeCss(themeData, "cobalt", 1))
  })

  it("reads a tune back through roleSpec", () => {
    expect(roleSpec(steel, "signal")).toEqual(steel.roles.signal)
    expect(roleSpec(steel, "signal", { signal: { hue: 12, chroma: 2 } })).toEqual({
      hue: 12,
      chroma: 2,
    })
  })
})

describe("colour conversion", () => {
  it("round-trips a hex through oklch", () => {
    const { l, c, h } = hexToOklch("#3b82f6")
    expect(oklchToHex(l, c, h)).toBe("#3b82f6")
  })

  it("reads short hex and clips out-of-gamut oklch", () => {
    expect(hexToOklch("#fff").c).toBeLessThan(0.001)
    expect(oklchToHex(0.72, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("turns a picked colour into a hue and a chroma multiplier", () => {
    const tune = tuneFromHex("#e11d48", "shell")
    expect(tune.hue).toBeGreaterThan(0)
    expect(tune.hue).toBeLessThan(360)
    expect(tune.chroma).toBeGreaterThan(0.5)
    expect(tune.chroma).toBeLessThanOrEqual(3)
  })

  it("keeps a random tune inside the ladder's range", () => {
    for (let run = 0; run < 20; run++) {
      for (const spec of Object.values(randomTune())) {
        expect(spec.hue).toBeGreaterThanOrEqual(0)
        expect(spec.hue).toBeLessThan(360)
        expect(spec.chroma).toBeGreaterThanOrEqual(0.4)
        expect(spec.chroma).toBeLessThanOrEqual(1.4)
      }
    }
  })
})

describe("readThemeChoice tunes", () => {
  it("takes a well-formed tune and drops a broken one", () => {
    const saved = JSON.stringify({
      preset: "steel",
      radius: 0.625,
      tune: { shell: { hue: 400, chroma: 9 }, signal: { hue: "red" }, base: null },
    })
    expect(readThemeChoice(saved, themeData)).toEqual({
      preset: "steel",
      radius: 0.625,
      tune: { shell: { hue: 40, chroma: 3 } },
    })
  })

  it("leaves the tune absent when nothing survives", () => {
    expect(readThemeChoice('{"preset":"rust","radius":0,"tune":{"shell":{}}}', themeData)).toEqual({
      preset: "rust",
      radius: 0,
    })
  })
})
