/**
 * Resolving a registry item to the thing that draws it.
 *
 * Shared by the generator (`build-gallery.mjs`) and the build-time check
 * (`check-gallery.mjs`) so the two can never disagree about what counts as
 * covered.
 */

import { readFile } from "node:fs/promises"

/**
 * Items whose own component cannot draw itself from a size alone: a teach
 * pendant is a control panel, not a machine, so its card shows the arm the
 * pendant drives.
 */
export const drawnBy = {
  "arm-controls": "robot-arm",
  // A record button wraps a machine; on its own it draws nothing at all.
  "robot-export": "robot-arm",
}

/** Foundations ship a `.ts` file, so each names the machine that exercises it. */
export const exercises = {
  "robot-kinematics": "robot-arm",
  "robot-style": "robot-arm",
  "robot-color": "orb-droid",
  "duck-kinematics": "micro-duck",
  "stewart-kinematics": "reachy-mini",
  "hand-kinematics": "robot-hand",
  "skeleton-kinematics": "robot-skeleton",
  "quadruped-kinematics": "robot-quadruped",
  "spine-kinematics": "robot-snake",
  "hexapod-kinematics": "robot-spider",
  "device-geometry": "slate-tablet",
  "transmission-geometry": "planetary-gearbox",
  "electromagnetism-geometry": "induction-motor",
  "linkage-geometry": "pumpjack",
  "voxel-geometry": "voxel-form",
  "household-geometry": "washing-machine",
  "vehicle-geometry": "robot-car",
  "use-robot-arm": "robot-arm",
  "use-robot-motion": "robot-loader",
  "use-pointer-target": "robot-face",
  "phyllotaxis-geometry": "robot-sunflower",
  "cactus-geometry": "robot-cactus",
  "celestial-geometry": "celestial-planet",
  "hull-geometry": "battle-station",
  "robot-capture": "robot-arm",
}

/**
 * The last resort. An item with no component and no alias still gets a card,
 * because invisible is the one outcome this whole file exists to prevent.
 */
export const fallbackMachine = "robot-arm"

/** Items whose component needs a WebGL context; the grid lazy-loads these. */
export const isWebgl = (source) =>
  source.includes("@react-three/fiber") || /from "three"/.test(source)

/** `robot-cat` → `RobotCat`, `robot-arm-3d` → `RobotArm3D`. */
export const pascalCase = (name) =>
  name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")

export const exportedNames = (source) => [
  ...[...source.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((match) =>
    match[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop().trim()),
  ),
  ...[...source.matchAll(/export (?:function|const|class) ([A-Za-z0-9_]+)/g)].map(
    (match) => match[1],
  ),
]

/**
 * Every registry item, resolved to how the gallery draws it. Throws rather
 * than skipping: a component that stopped exporting its own name is a build
 * error, not a quietly missing card.
 */
export async function resolveGallery(registry) {
  const ui = new Map()
  for (const item of registry.items) {
    if (item.type !== "registry:ui") continue
    const file = item.files?.find((entry) =>
      entry.path.startsWith("src/components/ui/"),
    )
    if (!file) {
      throw new Error(`${item.name}: registry:ui item ships no component file`)
    }
    const source = await readFile(file.path, "utf8")
    const wanted = pascalCase(item.name)
    const match = exportedNames(source).find(
      (name) => name.toLowerCase() === wanted.toLowerCase(),
    )
    if (!match) {
      throw new Error(
        `${item.name}: ${file.path} exports no ${wanted}. The gallery resolves ` +
          `components by the PascalCase of the item name — rename the export.`,
      )
    }
    ui.set(item.name, {
      name: item.name,
      export: match,
      module: file.path.replace(/^src\//, "@/").replace(/\.tsx?$/, ""),
      webgl: isWebgl(source),
      interface: item.categories?.includes("controls") ?? false,
    })
  }

  return registry.items.map((item) => {
    const own = drawnBy[item.name] ? undefined : ui.get(item.name)
    if (own) {
      return { item: item.name, draws: item.name, blueprint: false, ...own }
    }
    const alias = drawnBy[item.name] ?? exercises[item.name] ?? fallbackMachine
    const drawn = ui.get(alias)
    if (!drawn) {
      throw new Error(`${item.name}: exercises unknown item "${alias}"`)
    }
    // A solver is not a machine, so its card shows the machine that exercises
    // it as a drawing: the register the landing page reserves for explaining.
    // A control panel gets the machine it drives, painted normally.
    return {
      item: item.name,
      draws: alias,
      blueprint: item.type !== "registry:ui",
      interface: false,
      ...drawn,
    }
  })
}
