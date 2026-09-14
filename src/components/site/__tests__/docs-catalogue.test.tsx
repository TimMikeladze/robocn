import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { demoFor } from "@/components/demos/demos"
import { DocsCatalogue, type CatalogueEntry } from "@/components/site/docs-catalogue"
import { docs } from "@/lib/docs"

const droidSlugs = [
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
  "tripod-droid",
] as const

/** The two armoured walkers and the attitude solver under them. */
const walkerSlugs = ["scout-walker", "siege-walker", "walker-kinematics"] as const

/** The equine pair and the footfall solver under them. */
const equineSlugs = [
  "robot-horse",
  "robot-pegasus",
  "robot-camel",
  "gait-kinematics",
] as const

/** The vehicle family: seven machines and the solver under two of them. */
/** The football family, its solver, and the two training machines. */
const gridironSlugs = [
  "gridiron-geometry",
  "robot-football",
  "gridiron-lineman",
  "gridiron-quarterback",
  "gridiron-receiver",
  "gridiron-kicker",
  "blocking-sled",
  "ball-launcher",
] as const

const vehicleSlugs = [
  "robot-car",
  "transit-bus",
  "cargo-plane",
  "hydrofoil-craft",
  "launch-vehicle",
  "strike-starfighter",
  "ion-interceptor",
  "vehicle-geometry",
] as const

/** The rail family: four machines and the solver under all of them. */
const railSlugs = [
  "rail-locomotive",
  "rail-bogie",
  "pantograph-collector",
  "rail-turnout",
  "rail-geometry",
] as const

/** The produce family: three field units and the solver under them. */
const produceSlugs = [
  "robot-avocado",
  "robot-strawberry",
  "robot-tomato",
  "produce-geometry",
] as const

/** The bears, and the plantigrade solver under them. */
const ursineSlugs = ["robot-bear", "robot-polar-bear", "robot-panda", "bear-kinematics"] as const

/** The menagerie: twelve animals on the solvers the first five proved. */
const menagerieSlugs = [
  "robot-dragonfly",
  "robot-bat",
  "robot-jellyfish",
  "robot-manta",
  "robot-octopus",
  "robot-seahorse",
  "robot-ant",
  "robot-scorpion",
  "robot-mantis",
  "robot-frog",
  "robot-turtle",
  "robot-inchworm",
] as const

/** The fabrication family: three machines, the workpiece, and the sampler. */
const fabricationSlugs = [
  "fabricator",
  "arm-fabricator",
  "drone-fabricator",
  "voxel-form",
  "voxel-geometry",
] as const

/** The machine-parts family: the kit, and the transmission solver under it. */
const machinePartSlugs = [
  "planetary-gearbox",
  "belt-drive",
  "cable-carrier",
  "mecanum-wheel",
  "tool-changer",
  "suction-gripper",
  "robot-hand",
  "motion-platform",
  "transmission-geometry",
] as const

/** Electromagnetic actuators, machines, sensors, and their geometry helper. */
/** The oil field: ten machines and the closed-loop solver under them. */
const oilFieldSlugs = [
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
  "linkage-geometry",
] as const

const electromagneticSlugs = [
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
  "electromagnetism-geometry",
] as const

/** The mechanical music machines, and the two solvers under them. */
const soundSlugs = [
  "turntable-deck",
  "gramophone-horn",
  "music-box-drum",
  "busker-droid",
  "robot-grand-piano",
  "sound-geometry",
  "piano-geometry",
] as const

const deviceSlugs = [
  "clamshell-laptop",
  "slate-tablet",
  "wheel-player",
  "slab-handset",
  "folding-handset",
  "wrist-terminal",
  "device-geometry",
] as const

/** The input devices, and the solver under them. */
const inputSlugs = [
  "key-switch",
  "robot-keypad",
  "robot-keyboard",
  "input-terminal",
  "keyboard-geometry",
] as const

/** The humanoid frame: the hand rebuilt, the rest of the skeleton, two solvers. */
const skeletonSlugs = [
  "robot-hand",
  "robot-foot",
  "robot-leg",
  "robot-torso",
  "robot-skeleton",
  "hand-kinematics",
  "skeleton-kinematics",
] as const

/** The bodies, the machine that carries them, and the two new solvers. */
const celestialSlugs = [
  "celestial-planet",
  "celestial-moon",
  "celestial-star",
  "celestial-asteroid",
  "orrery",
  "celestial-geometry",
  "robot-sunflower",
  "phyllotaxis-geometry",
  "robot-cactus",
  "cactus-geometry",
  "battle-station",
  "debris-field",
  "hull-geometry",
] as const

/** The household: five machines and the solver under them. */
const householdSlugs = [
  "gabled-house",
  "tower-block",
  "espresso-machine",
  "refrigerator",
  "washing-machine",
  "household-geometry",
] as const

const entries: CatalogueEntry[] = [
  { slug: 'robot-arm', title: 'Robot arm', summary: 'Articulated chain with eight tools.', group: 'Arms', item: 'robot-arm' },
  { slug: 'robot-rover', title: 'Robot rover', summary: 'Ground vehicle with steering.', group: 'Robots', item: 'robot-rover' },
  { slug: 'installation', title: 'Installation', summary: 'Install source and dependencies.', group: 'Foundations', item: null },
]

describe('docs catalogue', () => {
  it.each(celestialSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(walkerSlugs)("documents and demos %s", (slug) => {
    const entry = docs.find((candidate) => candidate.slug === slug)
    expect(entry?.item).toBe(slug)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(droidSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(equineSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(gridironSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(vehicleSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(railSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(produceSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(ursineSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(fabricationSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(menagerieSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(soundSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(deviceSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(inputSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(machinePartSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(oilFieldSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(electromagneticSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(householdSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it.each(skeletonSlugs)("documents and demos %s", (slug) => {
    expect(docs.some((entry) => entry.slug === slug && entry.item === slug)).toBe(true)
    expect(demoFor(slug)).toBeTruthy()
  })

  it('matches case-insensitive title, slug and description terms', () => {
    const { getByRole, queryByRole } = render(<DocsCatalogue entries={entries} />)
    fireEvent.change(getByRole('searchbox'), { target: { value: '  GROUND steering ' } })
    expect(getByRole('link', { name: /Robot rover/ })).toBeTruthy()
    expect(queryByRole('link', { name: /Robot arm/ })).toBeNull()
    fireEvent.change(getByRole('searchbox'), { target: { value: 'robot-arm' } })
    expect(getByRole('link', { name: /Robot arm/ })).toBeTruthy()
  })

  it('combines category and search, then clears both from an empty result', () => {
    const { getByRole, queryByRole } = render(<DocsCatalogue entries={entries} />)
    fireEvent.click(getByRole('button', { name: /^Arms/ }))
    fireEvent.change(getByRole('searchbox'), { target: { value: 'rover' } })
    expect(getByRole('status').textContent).toContain('0')
    expect(queryByRole('link', { name: /Robot rover/ })).toBeNull()
    fireEvent.click(getByRole('button', { name: 'Clear filters' }))
    expect(getByRole('searchbox').getAttribute('value')).toBe('')
    expect(getByRole('link', { name: /Robot rover/ })).toBeTruthy()
    expect(getByRole('link', { name: /Installation/ })).toBeTruthy()
    expect(getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true')
  })
})
