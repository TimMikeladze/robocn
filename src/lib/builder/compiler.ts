import { build } from "esbuild"
import generated from "./generated.json"

export const MAX_CODE_LENGTH = 60_000
const modules: Record<string, { exports: string[]; api: string; item: string | null }> = generated.modules
const vendors = new Set(["react", "react/jsx-runtime", "react-dom/client", "lucide-react", "three", "@react-three/fiber", "@react-three/drei"])

export async function compileRobot(code: string) {
  if (!code.trim() || code.length > MAX_CODE_LENGTH) throw new Error("Component source must be between 1 and 60,000 characters.")
  const imports = new Set<string>()
  const result = await build({
    stdin: { contents: `import Robot from "robot-source"; window.__Robot = Robot;`, loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2022",
    jsx: "automatic", minify: true, logLevel: "silent",
    plugins: [{ name: "robocn-sandbox", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => {
        if (path === "robot-source") return { path, namespace: "robot" }
        if (modules[path] || vendors.has(path)) {
          imports.add(path)
          return { path, namespace: "library" }
        }
        return { errors: [{ text: `Unsupported import: ${path}. Use react, lucide-react, or an available @/ robocn module.` }] }
      })
      builder.onLoad({ filter: /.*/, namespace: "robot" }, () => ({ contents: code, loader: "tsx" }))
      builder.onLoad({ filter: /.*/, namespace: "library" }, ({ path }) => {
        const ref = `window.__robocn[${JSON.stringify(path)}]`
        // ESM stubs let the linker catch invented robocn exports before previewing.
        const contents = modules[path]
          ? modules[path].exports.map(name => name === "default" ? `export default ${ref}.default;` : `export const ${name} = ${ref}[${JSON.stringify(name)}];`).join("\n")
          : `module.exports = ${ref};`
        return { contents, loader: "js" }
      })
    } }],
  })
  return {
    javascript: result.outputFiles[0].text,
    dependencies: [...imports].flatMap(path => modules[path]?.item ? [modules[path].item!] : []),
    packages: [...imports].filter(path => vendors.has(path) && !["react", "react/jsx-runtime", "react-dom/client"].includes(path)),
    shadcnDependencies: [...imports].filter(path => modules[path] && !modules[path].item && path.startsWith("@/components/ui/")).map(path => path.split("/").at(-1)!),
  }
}

export function compileError(error: unknown) {
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    return error.errors.slice(0, 5).map((item: { text: string; location?: { line: number; column: number } }) =>
      `${item.location ? `Line ${item.location.line}:${item.location.column}: ` : ""}${item.text}`,
    ).join("\n")
  }
  return error instanceof Error ? error.message : "Unable to compile the component."
}

export function agentContext() {
  return `You build original robotic React components for robocn. Write real, detailed procedural SVG geometry, or compose existing robocn components when appropriate. A user may ask for entirely new robots, mechanisms, creatures, or scenes.
Return one complete TSX file with a default-exported React component. All helpers and custom geometry belong in that file. Use React imports explicitly. No markdown fences in code.
Follow-up instructions modify the supplied current source; preserve earlier features unless asked to change them.
Support size, variant (solid, outline, blueprint, wire), paused, animate, color and accent props. Pass these through when composing. For spatial models support view (front, profile, plan, iso) using robotCamera and ONE model. Never fake views by flattening the drawing. Label illustrated or limited views honestly in your explanation.
Use resolveRobotPalette, resolveRobotSize, robotSurface, px and real solvers where appropriate. Motion uses useRobotClock or useRobotScalar, respecting reduced motion and paused. Use an accessible SVG role and label. Prefer inline CSS/SVG attributes for new styles; existing library Tailwind classes are available, but arbitrary new Tailwind utilities are not compiled. Do not use remote assets, network requests, storage, eval, dynamic imports, or browser navigation. Do not access the parent window. The only available imports are the modules below and react, lucide-react, three, @react-three/fiber, @react-three/drei. Three.js components must render inside RobotStage or Canvas. Geometry stays in a fixed viewBox. Never use franchise names or logos.
The preview supplies {size: 320, variant, view, paused, color, accent, interactive: true}. No required props. Be visually thoughtful: silhouette, joints, panel seams, fasteners, optics, and believable motion.
AVAILABLE MODULES AND THEIR ACTUAL PUBLIC TYPES:
${Object.entries(modules).map(([path, mod]) => `${path}: exports ${mod.exports.join(", ")}\n${mod.api}`).join("\n\n")}
SHARED DRAWING IMPLEMENTATION (authoritative API):\n${generated.style}
MOTION IMPLEMENTATION (authoritative API):\n${generated.motion}`
}
