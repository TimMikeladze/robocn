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

describe("registry.json", () => {
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
