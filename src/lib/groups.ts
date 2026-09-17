/**
 * The taxonomy: one group per registry item, in the order everything lists them
 * — the docs sidebar, the landing grid, the index, the pager, `llms.txt`.
 *
 * An item carries its group in `registry.json` as the second entry of its own
 * `categories`, after the `robotics` umbrella: `["robotics", "animals"]`. That
 * is the only place it is written down. Notes: `docs/naming-and-categories.md`.
 */

export const groupTitles = {
  arms: "Arms",
  droids: "Droids",
  animals: "Animals",
  garden: "Garden",
  body: "Body",
  actuators: "Actuators",
  drives: "Drives",
  tools: "Tools",
  sensors: "Sensors",
  fabrication: "Fabrication",
  devices: "Devices",
  controls: "Controls",
  vehicles: "Vehicles",
  rail: "Rail",
  space: "Space",
  energy: "Energy",
  sport: "Sport",
  gym: "Gym",
  home: "Home",
  music: "Music",
  foundations: "Foundations",
} as const

export type GroupId = keyof typeof groupTitles
export type DocGroup = (typeof groupTitles)[GroupId]

export const groupIds = Object.keys(groupTitles) as GroupId[]

/** Display names in sidebar order. */
export const docGroups: DocGroup[] = groupIds.map((id) => groupTitles[id])

/** One line per group: what lands in it. The about page reads these. */
export const groupBlurbs: Record<DocGroup, string> = {
  Arms: "Articulated chains and the room they stand in — SVG and WebGL from one solver.",
  Droids: "Service units, walkers and companions, with poses, domes and deployable tools.",
  Animals: "Legged, winged and swimming machines, each on a solved gait.",
  Garden: "Fruit, vegetables and plants built as machines that open, track and grow.",
  Body: "The parts a humanoid is assembled from: hand, foot, leg, torso, skeleton.",
  Actuators: "The things that push: motors, solenoids, coils, brakes, bearings.",
  Drives: "The things that transmit: gearboxes, belts, carriers, wheels, stages.",
  Tools: "End effectors — grippers, suction, magnets, and the changer they hang on.",
  Sensors: "Instruments that report: scanning, proximity, shaft angle.",
  Fabrication: "Machines that make: deposition cells, the workpiece, the line.",
  Devices: "Consumer hardware as mechanism: laptops, tablets, handsets, wearables.",
  Controls: "Widgets rather than machines — keys, keypads, terminals, faces, loaders.",
  Vehicles: "Things that travel: road, water, air, and the aeroplane you take apart.",
  Rail: "Rolling stock and the track under it, from bogie to turnout.",
  Space: "Bodies, orbits and craft — planets, moons, debris, interceptors, stations.",
  Energy: "The oilfield end to end: lift, drilling, separation, storage, flare.",
  Sport: "Gridiron players, balls and pucks, and the rigs that launch them.",
  Gym: "Resistance machines, each solved as the linkage it really is.",
  Home: "Buildings and appliances: houses, towers, coffee, cold, laundry, lanterns.",
  Music: "Sound made mechanically: decks, horns, drums, and a grand piano.",
  Foundations: "The maths and the hooks underneath all of it. No React in the solver.",
}

export const isGroupId = (value: string): value is GroupId => value in groupTitles

/**
 * An item's group, from its categories. Anything that is not a `registry:ui`
 * item is a foundation whatever it says, and an item whose second category is
 * missing or unknown falls there too rather than vanishing from the site.
 */
export function groupOf(item: { type: string; categories?: string[] }): DocGroup {
  const id = (item.categories ?? [])[1]
  if (item.type !== "registry:ui") return groupTitles.foundations
  return id && isGroupId(id) ? groupTitles[id] : groupTitles.foundations
}
