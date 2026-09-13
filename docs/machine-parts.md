# Machine parts

Eight machines and one solver, all of them *parts* rather than cells. The Machines group
already has things that make something (`fabricator`) or move something (`conveyor-belt`,
`rotary-table`). What it did not have is the kit a machine is assembled out of: the
transmission between a motor and the thing it turns, the carrier that feeds the moving axis,
the wheel, the coupler, and the end of arm.

## What ships

| Item | Mechanism | Solver | Native view |
|---|---|---|---|
| `transmission-geometry` | lib | — | — |
| `planetary-gearbox` | sun, planets, ring, carrier output | `transmission` | `front` |
| `belt-drive` | two pulleys, toothed belt, idler tensioner | `transmission` | `front` |
| `cable-carrier` | energy chain over a rolling U-bend | `transmission` | `profile` |
| `mecanum-wheel` | hub with barrel rollers at 45° | inline | `profile` |
| `tool-changer` | robot-side and tool-side coupler, ball lock | inline | `front` |
| `suction-gripper` | bellows cup bar lifting a sheet | inline | `front` |
| `robot-hand` | five fingers, three phalanges each | `kinematics` | `front` |
| `motion-platform` | six-rod Stewart base under a payload deck | `stewart` | `iso` |

## Why each one earns its place

- **`planetary-gearbox`** is the first machine in the set whose *teeth* are geometry rather
  than decoration. Two meshing gears are drawn from one phase relationship, so the sun cannot
  turn without the planets turning the right way at the right ratio. New axis: `ratio`, read
  off the tooth counts instead of being typed in.
- **`belt-drive`** is not `conveyor-belt`. The conveyor is a flat carrying surface with parts
  on it; this is a transmission — unequal pulleys, a real taut-belt path, wrap angles, and an
  idler you can move to take up slack. The belt teeth march by arc length, so the driven
  pulley turns at the ratio the diameters actually give.
- **`cable-carrier`** is the part every gantry has and nobody draws. The bend travels at half
  the carriage speed because the chain length is constant — that is the whole mechanism, and
  it is the one thing the drawing must get right.
- **`mecanum-wheel`** is a wheel whose rollers do the work. Handedness (`left` / `right`) is
  the axis: a holonomic base needs both, and the difference is a 90° flip of the roller axis.
- **`tool-changer`** is the only machine in the set that comes apart. `engagement` runs the
  two halves from parked, through the approach, to locked, with the ball detents driven out by
  the piston rather than drawn in place.
- **`suction-gripper`** is `robot-gripper`'s opposite number: no fingers, no pivot, a row of
  bellows that compress against a sheet and a vacuum line that either holds or does not. Past
  contact the head stops and the bellows take up the rest of the stroke, which is how a cup
  bar lands on a part whose height it does not know.
- **`robot-hand`** is five three-link chains posed forward, with a thumb that opposes across
  the palm. `grasp` names the four grips a hand actually makes; `curl` is the continuous axis
  underneath them.
- **`motion-platform`** reuses `stewart.ts`, which until now only ever drove a companion head.
  Here it is the machine: a payload deck, six actuators with visible stroke, and a readout of
  the longest leg — the number that tells you whether a pose is reachable.

## The solver

`src/lib/robocn/transmission.ts` — registry item `transmission-geometry`. Three mechanisms
that all come down to "where does the flexible thing go", plus the gear teeth:

```ts
gearPath(teeth, pitchRadius, options?)       // one gear's outline, teeth included
meshAngle(driver, driven, bearing)           // the phase that puts a tooth in a space
planetaryTrain(sunTeeth, planetTeeth, count) // assembly-valid tooth counts and the ratio
planetaryPose(train, sunAngle)               // carrier, planet centres, planet spins
beltLayout(pulleys)                          // taut-belt tangents, wrap angles, total length
beltSample(layout, distance)                 // a point and a heading at an arc length
carrierLinks(travel, geometry)               // energy-chain link placements over the bend
```

Invariants the tests hold it to:

- a planetary train is only returned when it assembles — `(sun + ring)` divisible by the
  planet count — and the reduction is exactly `1 + ring / sun`;
- meshing gears counter-rotate at `-N₁/N₂`, and at the line of centres one presents a tooth
  where the other presents a space;
- a belt round two equal pulleys is `2 × centres + 2πr` long, and every wrap angle sums with
  the tangents to the same total however many pulleys there are;
- an energy chain keeps its link count and its pitch at every travel, and its bend centre
  moves at exactly half the carriage.

None of it is dynamics. There is no torque, no belt tension, no backlash, no friction — the
gearbox will happily turn a ratio that would strip itself. The docs `notes` say so on each
machine.

## The shared contract

Unchanged from the rest of the set: `color`/`accent`/`metal`/`dark` palette roles, `size`,
`variant`, `view`, a `behavior` union that always contains `"static"`, a controlled value prop
that wins and stops the loop, `interactive` for pointer and keyboard, and a `data-*` hook on
every mechanism.

| Machine | Controlled prop | `behavior` | Grabbed |
|---|---|---|---|
| `planetary-gearbox` | `angle` (input shaft) | `run`, `jog`, `static` | Drag round the centre to wind it; arrows step 10°. `onAngleChange` |
| `belt-drive` | `travel` (belt turns) | `run`, `shuttle`, `static` | Drag the belt along its run. `onTravelChange` |
| `cable-carrier` | `travel` (carriage, 0–1) | `cycle`, `creep`, `static` | Drag the carriage. `onTravelChange` |
| `mecanum-wheel` | `angle` (hub) | `roll`, `crab`, `static` | Drag to spin the hub. `onAngleChange` |
| `tool-changer` | `engagement` (0–1) | `dock`, `latch`, `static` | Drag the tool half up to the coupler. `onEngagementChange` |
| `suction-gripper` | `descent` (0–1) | `cycle`, `breathe`, `static` | Drag the bar down onto the sheet. `onDescentChange` |
| `robot-hand` | `curl` (0–1) | `grip`, `wave`, `static` | Drag to close the hand; click, Enter or Space cycles the grasp. `onCurlChange`, `onGraspChange` |
| `motion-platform` | `heave`/`roll`/`pitch`/`yaw` | `settle`, `sway`, `static` | Drag the deck to tip it. `onPoseChange` |

## `data-*` hooks

API, not implementation detail:

`data-sun`, `data-planet="0"`, `data-carrier`, `data-ring`; `data-pulley="drive"`,
`data-belt`, `data-idler`; `data-link="3"`, `data-carriage`; `data-hub`, `data-roller="2"`;
`data-half="robot"`, `data-half="tool"`, `data-lock`; `data-cup="1"`, `data-sheet`, `data-bar`;
`data-finger="index"`, `data-phalanx="index-2"`, `data-palm`; `data-deck`, `data-leg="0"`,
`data-base`.

## Views

All eight take the `view` axis. The gearbox, the belt drive, the coupler, the cup bar and the
hand are drawn as elevations and go through `camera.wall()`; the wheel and the carrier are
drawn in the plane they work in. The mecanum wheel is the one that gains the most from the
axis — the roller skew is invisible dead-on and obvious in `iso`, which is exactly what the
part is for.

## Verification

`vitest` for the solver invariants above and for each machine's controlled axis, accessible
label, invalid input and palette override; `tsc --noEmit`; `eslint`; `pnpm registry:build`;
`next build`; and driven in a browser on desktop and at 390px with reduced motion forced on.
