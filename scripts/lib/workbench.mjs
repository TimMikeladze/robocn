/**
 * Reading a robot component's props out of its own source.
 *
 * The workbench has no stories and no hand-written `argTypes`: every knob on
 * the stage is derived from the TypeScript a component already ships. This
 * module is the derivation, kept apart from `build-workbench.mjs` so the
 * classification can be tested against real component sources.
 *
 * It reads the AST, not the type checker. Everything in `src/lib/robocn` and
 * `src/components/ui` states its prop types as string-literal unions, plain
 * `number`/`boolean`/`string`, or an exported alias for one of those, so an
 * index of the repository's own aliases resolves them all in a fraction of the
 * time a `ts.Program` would take — and `pnpm generate` runs on every dev boot.
 */

import ts from "typescript"

/**
 * @typedef {{ name: string, optional?: boolean, type: string, union?: string[] | null, numbers?: number[] | null, doc: string }} Member
 * @typedef {{ heritage: string[], members: Member[] }} Interface
 * @typedef {{ unions: Record<string, string[]>, interfaces: Record<string, Interface> }} TypeIndex
 * @typedef {string | number | boolean | undefined} PropValue
 * @typedef {{ name: string, type: string, doc: string, group: string, kind: string, default?: PropValue, options?: (string | number)[], numeric?: boolean, min?: number, max?: number, step?: number }} Control
 */

/**
 * A machine is anything that draws itself with robocn's own vocabulary: the
 * palette, the camera, the clock. Shadcn primitives share the `ui` folder and
 * are not machines, and this is what tells a draft robot from a button.
 */
export const isRobotSource = (source) =>
  /from "@\/(lib\/robocn|hooks\/use-robot)/.test(source)

/** `robot-arm` → `Robot arm`, for a draft with no registry title to print. */
export const titleCase = (name) => {
  const words = name.replace(/-/g, " ")
  return words[0].toUpperCase() + words.slice(1)
}

/** Roles in the shared palette. A `string` prop named for one is a colour. */
export const paletteRoles = ["color", "accent", "metal", "dark", "glow", "grid"]

/** Never a knob: React plumbing the stage sets itself. */
const ignored = new Set(["className", "style", "children", "ref", "key", "id"])

/** Which drawer of the controls panel a prop falls into. */
const groups = {
  frame: ["size", "variant", "view", "mount", "label", "showGround", "showEnvelope", "showGrid", "showLabels", "showShadow"],
  motion: ["animate", "paused", "speed", "phase", "behavior", "behaviour", "interactive", "gait", "cycle", "loop"],
}

export function groupFor(name) {
  if (paletteRoles.includes(name) || name === "palette") return "palette"
  if (groups.frame.includes(name)) return "frame"
  if (groups.motion.includes(name)) return "motion"
  return "shape"
}

const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const docOf = (node) => {
  const [doc] = ts.getJSDocCommentsAndTags(node)
  const comment = doc && "comment" in doc ? doc.comment : undefined
  return (typeof comment === "string" ? comment : "").replace(/\s+/g, " ").trim()
}

const literalUnion = (node) => {
  if (!ts.isUnionTypeNode(node)) return null
  const values = node.types.map((member) =>
    ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)
      ? member.literal.text
      : null,
  )
  return values.every((value) => value !== null) ? values : null
}

/** `2 | 4` is a picker too, and its values must stay numbers on the way out. */
const numericUnion = (node) => {
  if (!ts.isUnionTypeNode(node)) return null
  const values = node.types.map((member) =>
    ts.isLiteralTypeNode(member) && ts.isNumericLiteral(member.literal)
      ? Number(member.literal.text)
      : null,
  )
  return values.every((value) => value !== null) ? values : null
}

/**
 * Every exported string-literal union and every interface in the files given,
 * by name. Interfaces keep their heritage so `extends RobotPaletteProps` can be
 * expanded where the component is read, one file away from where it is written.
 */
/**
 * @param {{ file: string, source: string }[]} files
 * @returns {TypeIndex}
 */
export function indexTypes(files) {
  /** @type {Record<string, string[]>} */
  const unions = {}
  /** @type {Record<string, Interface>} */
  const interfaces = {}
  for (const { file, source } of files) {
    const ast = parse(file, source)
    for (const statement of ast.statements) {
      if (ts.isTypeAliasDeclaration(statement)) {
        const values = literalUnion(statement.type)
        if (values) unions[statement.name.text] = values
        continue
      }
      if (!ts.isInterfaceDeclaration(statement)) continue
      const heritage = (statement.heritageClauses ?? []).flatMap((clause) =>
        clause.types.flatMap((type) =>
          ts.isIdentifier(type.expression) && !type.typeArguments
            ? [type.expression.text]
            : [],
        ),
      )
      interfaces[statement.name.text] = {
        heritage,
        members: statement.members.flatMap((member) =>
          ts.isPropertySignature(member) && member.type && ts.isIdentifier(member.name)
            ? [{
                name: member.name.text,
                optional: Boolean(member.questionToken),
                type: member.type.getText(ast).replace(/\s+/g, " "),
                union: literalUnion(member.type),
                numbers: numericUnion(member.type),
                doc: docOf(member),
              }]
            : [],
        ),
      }
    }
  }
  return { unions, interfaces }
}

/** An interface's own members plus everything it extends, base first. */
/**
 * @param {string | null} name
 * @param {TypeIndex} index
 * @returns {Member[]}
 */
function membersOf(name, index, seen = new Set()) {
  if (!name || seen.has(name) || !index.interfaces[name]) return []
  seen.add(name)
  const entry = index.interfaces[name]
  const inherited = entry.heritage.flatMap((base) => membersOf(base, index, seen))
  const own = new Set(entry.members.map((member) => member.name))
  return [...inherited.filter((member) => !own.has(member.name)), ...entry.members]
}

const literalValue = (node, constants = {}) => {
  if (!node) return undefined
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = literalValue(node.operand, constants)
    return typeof inner === "number" ? -inner : undefined
  }
  // `view = NATIVE_VIEW`, `reach = DEFAULT_REACH`: a component naming its own
  // default is still stating one, and the stage should open on it.
  if (ts.isIdentifier(node)) return constants[node.text]
  return undefined
}

/** Every file-level `const NAME = <literal>`, by name. */
function fileConstants(ast) {
  /** @type {Record<string, Exclude<PropValue, undefined>>} */
  const constants = {}
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue
      const value = literalValue(declaration.initializer)
      if (value !== undefined) constants[declaration.name.text] = value
    }
  }
  return constants
}

/**
 * The component's parameter list: which props interface it takes, and what it
 * destructures each prop to when the caller says nothing. Those defaults are
 * the pose the stage opens on, which is the pose `<RobotArm />` draws.
 */
/**
 * @returns {{ props: string | null, defaults: Record<string, Exclude<PropValue, undefined>> }}
 */
export function readSignature(file, source, exportName) {
  const ast = parse(file, source)
  const constants = fileConstants(ast)
  /** @type {{ props: string | null, defaults: Record<string, Exclude<PropValue, undefined>> } | null} */
  let found = null
  const visit = (node) => {
    if (found) return
    const isNamed =
      (ts.isFunctionDeclaration(node) && node.name?.text === exportName) ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === exportName &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
    if (isNamed) {
      const fn = ts.isFunctionDeclaration(node) ? node : node.initializer
      const [parameter] = fn.parameters
      /** @type {Record<string, Exclude<PropValue, undefined>>} */
      const defaults = {}
      if (parameter && ts.isObjectBindingPattern(parameter.name)) {
        for (const element of parameter.name.elements) {
          if (!ts.isIdentifier(element.name) && !element.propertyName) continue
          const name = element.propertyName?.getText(ast) ?? element.name.getText(ast)
          const value = literalValue(element.initializer, constants)
          if (value !== undefined) defaults[name.replace(/["']/g, "")] = value
        }
      }
      const type = parameter?.type
      found = {
        props: type && ts.isTypeReferenceNode(type) ? type.typeName.getText(ast) : null,
        defaults,
      }
      return
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(ast, visit)
  return found ?? { props: null, defaults: {} }
}

/**
 * A slider needs an end. The prop's own name and doc say more than its type.
 * @param {string} name
 * @param {string} doc
 * @param {PropValue} [fallback]
 * @returns {{ min: number, max: number, step: number }}
 */
export function numberRange(name, doc, fallback) {
  const text = `${name} ${doc}`.toLowerCase()
  if (/angle|heading|yaw|pitch|roll|azimuth|rotation|tilt|bearing|degrees/.test(text)) {
    return { min: -180, max: 180, step: 1 }
  }
  if (name === "phase" || /turn of the cycle|cycle position/.test(text)) {
    return { min: 0, max: 1, step: 0.005 }
  }
  if (name === "speed" || /per second|cycles|hz/.test(text)) {
    return { min: 0, max: 3, step: 0.01 }
  }
  if (/\b0\b[^.]{0,40}\b1\b|0–1|0 to 1|fraction|extension|progress|amount|ratio|blend|charge|fill|level|opacity|intensity|strength|openness|wear|load/.test(text)) {
    return { min: 0, max: 1, step: 0.01 }
  }
  if (/count|segments|links|teeth|rows|columns|sides|spokes|slots|samples|steps|stacks|legs|rings|lobes/.test(text)) {
    return { min: 1, max: 24, step: 1 }
  }
  if (/\bsize\b|width|height|radius|length|pixels|px\b/.test(text)) {
    return { min: 8, max: 512, step: 1 }
  }
  const base = typeof fallback === "number" && fallback !== 0 ? Math.abs(fallback) * 3 : 1
  const step = base > 50 ? 1 : base > 5 ? 0.1 : 0.01
  if (typeof fallback === "number" && fallback < 0) {
    return { min: -Math.ceil(base), max: Math.ceil(base), step }
  }
  return { min: 0, max: Math.ceil(base * 10) / 10, step }
}

/**
 * One prop, resolved to the widget that can drive it.
 * @param {Member} member
 * @param {TypeIndex} index
 * @param {PropValue} [fallback]
 * @returns {Control}
 */
export function classify(member, index, fallback) {
  const type = member.type.replace(/\s*\|\s*undefined$/, "").trim()
  const base = {
    name: member.name,
    type: member.type,
    doc: member.doc,
    group: groupFor(member.name),
    default: fallback,
  }
  // A callback cannot be driven from a panel, but it can be watched: the stage
  // hands these a logger and prints the calls, which is how you see a component
  // report a pointer target or a finished cycle.
  if (/^on[A-Z]/.test(member.name) && /=>\s*void\s*$/.test(type)) {
    return { ...base, kind: "action" }
  }
  if (type === "boolean") return { ...base, kind: "boolean" }
  if (member.numbers) return { ...base, kind: "enum", options: member.numbers, numeric: true }
  if (type === "number") return { ...base, kind: "number", ...numberRange(member.name, member.doc, fallback) }
  if (/^RobotSize \| number$/.test(type) || /^(RobotSize)$/.test(type)) {
    return { ...base, kind: "size", options: index.unions.RobotSize ?? ["xs", "sm", "md", "lg", "xl"] }
  }
  const options = member.union ?? index.unions[type] ?? null
  if (options) return { ...base, kind: "enum", options }
  if (type === "string") {
    return paletteRoles.includes(member.name) || /colou?r$/i.test(member.name)
      ? { ...base, kind: "color" }
      : { ...base, kind: "text" }
  }
  return { ...base, kind: "unsupported" }
}

/**
 * Every knob for one component, in the order its author declared the props.
 * @param {{ file: string, source: string, exportName: string, index: TypeIndex }} input
 * @returns {{ props: string | null, controls: Control[] }}
 */
export function controlsFor({ file, source, exportName, index }) {
  const signature = readSignature(file, source, exportName)
  const members = membersOf(signature.props, index)
  const seen = new Set()
  /** @type {Control[]} */
  const controls = []
  for (const member of members) {
    if (ignored.has(member.name) || seen.has(member.name)) continue
    seen.add(member.name)
    controls.push(classify(member, index, signature.defaults[member.name]))
  }
  return { props: signature.props, controls }
}
