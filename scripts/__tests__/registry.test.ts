import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { docs } from "../../src/lib/docs"

interface RegistryFile {
  path: string
  type: string
  target?: string
}

interface RegistryItem {
  name: string
  type: string
  title: string
  description: string
  files: RegistryFile[]
  registryDependencies?: string[]
}

const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
  name: string
  homepage: string
  items: RegistryItem[]
}

const names = new Set(registry.items.map((item) => item.name))
const droidCollection = [
  "utility-droid",
  "orb-droid",
  "bellows-droid",
  "protocol-droid",
  "security-droid",
  "medical-droid",
  "infantry-droid",
  "probe-droid",
  "courier-droid",
  "casing-droid",
  "astromech-droid",
  "attendant-droid",
  "cyber-trooper",
  "robot-hound",
  "guide-droid",
  "pylon-droid",
  "custodian-droid",
  "sentinel-console",
  "monolith-droid",
  "busker-droid",
] as const

/** The equine pair and the footfall solver under them. */
const equineCollection = [
  "robot-horse",
  "robot-pegasus",
  "robot-camel",
] as const

const vehicleCollection = [
  "robot-car",
  "transit-bus",
  "cargo-plane",
  "hydrofoil-craft",
  "launch-vehicle",
  "strike-starfighter",
  "ion-interceptor",
] as const

const produceCollection = [
  "robot-avocado",
  "robot-strawberry",
  "robot-tomato",
] as const

/** The bears: plantigrade machines on one support solver. */
const ursineCollection = ["robot-bear", "robot-polar-bear", "robot-panda"] as const

/** The oil field: ten machines and the closed-loop solver under three of them. */
const oilFieldCollection = [
  "pumpjack",
  "drilling-derrick",
  "mud-pump",
  "wellhead-tree",
  "storage-tank",
  "oil-tanker",
  "tanker-truck",
  "flare-stack",
  "fractionating-column",
  "jackup-rig",
] as const

const electromagneticMachines = [
  "solenoid-valve",
  "electromagnetic-relay",
  "induction-motor",
  "stepper-motor",
  "voice-coil-actuator",
  "magnetic-bearing",
  "eddy-current-brake",
  "maglev-carriage",
  "magnetic-gripper",
  "inductive-sensor",
  "resolver",
  "transformer-core",
] as const

/** The mechanical music machines, on one sound-geometry solver. */
const soundMachines = [
  "turntable-deck",
  "gramophone-horn",
  "music-box-drum",
  "busker-droid",
] as const

/** The household: the building you live in, and the machines inside it. */
const householdCollection = [
  "gabled-house",
  "tower-block",
  "espresso-machine",
  "refrigerator",
  "washing-machine",
] as const

/** The personal devices: five machines you carry, on one geometry solver. */
const deviceCollection = [
  "clamshell-laptop",
  "slate-tablet",
  "wheel-player",
  "slab-handset",
  "wrist-terminal",
] as const

/** The input devices: four machines you type on, on one geometry solver. */
const inputCollection = [
  "key-switch",
  "robot-keypad",
  "robot-keyboard",
  "input-terminal",
] as const

/** The bodies, and the solver under them. */
const celestialCollection = [
  "celestial-planet",
  "celestial-moon",
  "celestial-star",
  "celestial-asteroid",
  "orrery",
] as const

/** The station, what is left of it, and the solver under both. */
const hullCollection = ["battle-station", "debris-field"] as const

describe("registry.json", () => {
  it.each(soundMachines)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
    expect(item?.registryDependencies).toContain("{REGISTRY_URL}/r/sound-geometry.json")
  })

  it.each(householdCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
    expect(item?.registryDependencies).toContain("{REGISTRY_URL}/r/household-geometry.json")
  })

  it.each(deviceCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(inputCollection)("publishes %s on the keyboard solver", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
    expect(item?.registryDependencies).toContain("{REGISTRY_URL}/r/keyboard-geometry.json")
  })

  it.each(celestialCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(hullCollection)("publishes %s on the hull solver", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
    expect(item?.registryDependencies).toContain("{REGISTRY_URL}/r/hull-geometry.json")
  })

  it("publishes robot-sunflower as one UI source file", () => {
    const item = registry.items.find((candidate) => candidate.name === "robot-sunflower")
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe("src/components/ui/robot-sunflower.tsx")
  })

  it.each(droidCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(equineCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(vehicleCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(produceCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(ursineCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it.each(oilFieldCollection)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it("ships the closed-loop solver the oil field is built on", () => {
    const item = registry.items.find((candidate) => candidate.name === "linkage-geometry")
    expect(item?.type).toBe("registry:lib")
    expect(item?.files[0]?.path).toBe("src/lib/robocn/linkage.ts")
  })

  it.each(electromagneticMachines)("publishes %s as one UI source file", (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
    expect(item?.files[0]?.path).toBe(`src/components/ui/${name}.tsx`)
  })

  it("has unique names and a documentation page for every published item", () => {
    expect(names.size).toBe(registry.items.length)
    const documented = docs.filter(entry => entry.item !== null)
    expect(new Set(documented.map(entry => entry.item)).size).toBe(documented.length)
    expect(new Set(documented.map(entry => entry.item))).toEqual(names)
    for (const item of registry.items) {
      const doc = documented.find(entry => entry.item === item.name)!
      expect(doc.files.length, item.name).toBeGreaterThan(0)
      for (const file of doc.files) {
        expect(item.files.some(source => source.path === `src/${file}`), `${item.name}: undocumented source ownership for ${file}`).toBe(true)
      }
    }
  })

  it("ships every file it claims to", () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(existsSync(file.path), `${item.name}: ${file.path}`).toBe(true)
      }
    }
  })

  it("gives every item a title, a description and a target", () => {
    for (const item of registry.items) {
      expect(item.title, item.name).toBeTruthy()
      expect(item.description.length, item.name).toBeGreaterThan(20)
      for (const file of item.files) {
        expect(file.target, `${item.name}: ${file.path}`).toMatch(/^@(ui|lib|hooks)\//)
      }
    }
  })

  it("only depends on items in this registry or on shadcn's own", () => {
    const shadcn = new Set(["button", "card", "label", "select", "slider"])
    for (const item of registry.items) {
      for (const dependency of item.registryDependencies ?? []) {
        if (dependency.startsWith("{REGISTRY_URL}")) {
          const name = dependency.replace("{REGISTRY_URL}/r/", "").replace(".json", "")
          expect(names.has(name), `${item.name} -> ${name}`).toBe(true)
        } else {
          expect(shadcn.has(dependency), `${item.name} -> ${dependency}`).toBe(true)
        }
      }
    }
  })

  it("declares every import a consumer would need", () => {
    // An item that imports from another robocn file has to pull it in, or the
    // install lands broken.
    const owners = new Map<string, string>()
    for (const item of registry.items) {
      for (const file of item.files) {
        owners.set(file.path, item.name)
      }
    }
    for (const item of registry.items) {
      const dependencies = new Set(
        (item.registryDependencies ?? []).map((dependency) =>
          dependency.replace("{REGISTRY_URL}/r/", "").replace(".json", ""),
        ),
      )
      for (const file of item.files) {
        const source = readFileSync(file.path, "utf8")
        const imports = source.matchAll(/from "(@\/(?:lib\/robocn|hooks|components\/ui)\/[^"]+)"/g)
        for (const [, specifier] of imports) {
          const path = `src/${specifier.slice(2)}`
          const owner =
            owners.get(`${path}.ts`) ?? owners.get(`${path}.tsx`) ?? null
          if (owner === item.name) continue
          if (!owner) {
            const shadcnName = specifier.startsWith("@/components/ui/") ? specifier.split("/").at(-1) : null
            expect(shadcnName && dependencies.has(shadcnName), `${item.name}: unregistered import ${specifier}`).toBeTruthy()
            continue
          }
          expect(
            dependencies.has(owner),
            `${item.name} imports ${specifier} but does not depend on ${owner}`,
          ).toBe(true)
        }
      }
    }
  })
})
