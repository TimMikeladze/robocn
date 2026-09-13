import { build } from "esbuild"
import { readFile, access, mkdir, writeFile } from "node:fs/promises"
import ts from "typescript"
import postcss from "postcss"
import tailwindcss from "@tailwindcss/postcss"

// Bundle trusted library code once. User code never gets filesystem access.
const registry = JSON.parse(await readFile("registry.json", "utf8"))
const paths = [...new Set([
  ...registry.items.flatMap(item => item.files.map(file => file.path)),
  "src/lib/utils.ts",
])]
const modules = {}
const imports = []
const entries = []
for (const [index, file] of paths.entries()) {
  const specifier = file.replace(/^src\//, "@/").replace(/\.tsx?$/, "")
  const source = await readFile(file, "utf8")
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  // Follow actual library imports (including shadcn controls) without pulling in
  // unrelated, unfinished components elsewhere in the worktree.
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue
    const specifier = node.moduleSpecifier.text
    if (!specifier.startsWith("@/")) continue
    const base = specifier.replace(/^@\//, "src/")
    for (const extension of [".ts", ".tsx"]) {
      const dependency = base + extension
      try {
        await access(dependency)
        if (!paths.includes(dependency)) paths.push(dependency)
        break
      } catch { /* Try the other source extension. */ }
    }
  }
  const api = ast.statements.filter(node =>
    (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
    node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword),
  ).map(node => node.getText(ast)).join("\n")
  const result = await build({ stdin: { contents: source, sourcefile: file, loader: file.endsWith("tsx") ? "tsx" : "ts" }, bundle: false, format: "esm", write: false, metafile: true, logLevel: "silent" })
  const exports = Object.values(result.metafile.outputs)[0].exports
  const item = registry.items.find(item => item.files.some(f => f.path === file))
  modules[specifier] = { exports, api, source, item: item?.name ?? null, title: item?.title ?? "", description: item?.description ?? "", type: item?.type ?? "" }
  imports.push(`import * as m${index} from ${JSON.stringify("./" + file)};`)
  entries.push(`${JSON.stringify(specifier)}:m${index}`)
}
for (const [index, specifier] of ["react", "react/jsx-runtime", "react-dom/client", "lucide-react", "three", "@react-three/fiber", "@react-three/drei"].entries()) {
  imports.push(`import * as vendor${index} from ${JSON.stringify(specifier)};`)
  entries.push(`${JSON.stringify(specifier)}:vendor${index}`)
}
await mkdir("public", { recursive: true })
await mkdir("src/lib/builder", { recursive: true })
await build({
  stdin: { contents: `${imports.join("\n")}\nwindow.__robocn = {${entries.join(",")}};`, resolveDir: process.cwd() },
  bundle: true, minify: true, format: "iife", platform: "browser", target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "public/builder-runtime.js", logLevel: "warning",
})
const style = await readFile("src/lib/robocn/style.ts", "utf8")
const motion = await readFile("src/hooks/use-robot-motion.ts", "utf8")
await writeFile("src/lib/builder/generated.json", JSON.stringify({ modules, style, motion }))
const css = await postcss([tailwindcss({ base: process.cwd() })]).process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" })
await writeFile("public/builder-runtime.css", css.css)
console.log(`Builder runtime prepared: ${paths.length} robocn modules.`)
