# Motion and interaction

Every robocn component moves on its own, and every one of them can be grabbed. This
document is the contract both halves follow, and the per-machine table of what
"moves" and "grabbed" mean for each.

## Why

Half the set animated and half did not. `robot-arm`, the loader and the conveyor ran
their own loops; the duck, the quadruped, the servo, the actuator, the table, the
rover, the drone and the lidar were pose illustrations that only moved if the page
around them owned a timeline. A registry of machines should not need a timeline
wired up before it looks like machinery, and a machine on a page is the one thing a
visitor will try to touch.

## The contract

Three rules, the same everywhere, so learning one component teaches all of them.

**1. Controlled wins.** A supplied value prop (`extension`, `angle`, `phase`, …) is
rendered exactly as given, with no internal loop. This is what ships today and it
does not change: existing controlled usage keeps rendering the same drawing.

**2. Uncontrolled runs.** Leave the value prop out and the machine animates itself.
What it does is `behavior`, a per-component union (`"cycle"`, `"sweep"`, `"index"`,
`"patrol"`, …) always including `"static"` for a still drawing. `speed` scales the
cycle, `phase` offsets it so a row of machines breaks step, `paused` freezes it,
`animate={false}` and a reduced-motion preference park it at `phase`.

**3. Interaction yields, then resumes.** `interactive` turns the machine into a
control: drag it, arrow-key it, click it. While the pointer holds it, the machine
tracks the pointer exactly. On release, its value eases back into whatever the
behavior is doing at that moment — rate-limited, the way a servo returns rather
than a snap. An `on…Change` callback fires throughout, so interaction works in
controlled mode too: the component reports, the caller decides.

Interaction never depends on hover alone. Every draggable is also a pointerdown
target, so a touch device gets the same control a mouse does.

## The shared hook

`src/hooks/use-robot-motion.ts`, registry item `use-robot-motion`. It is the only
new dependency the animated components take.

| Export | What it does |
|---|---|
| `useReducedMotion()` | Subscribes to `(prefers-reduced-motion: reduce)`. |
| `useRobotClock(options)` | Seconds × `speed` since mount, offset by `phase`. Parks at `phase` when disabled; holds where it stands when `paused`. |
| `useRobotScalar(goal, options)` | One rAF loop that advances the clock *and* eases a scalar toward `goal(clock)` at `rate` units/second. `hold` pins the value (a drag, or a controlled prop) while the clock keeps running underneath, which is what makes release read as a return rather than a jump. |
| `useRobotDrag(ref, options)` | Pointer capture on press, unit coordinates on every move, `dragging` back for the cursor. |
| `approach(value, goal, step)` | The rate limiter itself, pure and testable. |
| `arrowStep(event, step)` | Arrow/Page keys as a signed delta; `0` for keys that are not ours. |

`useRobotArm` and `useEasedPoint` stay where they are: they solve chains, and the
new hook is for machines with no chain to solve.

## Per component

Each machine gets the motion its mechanism would actually have, and the
interaction a person would actually try on it.

| Component | Uncontrolled motion (`behavior`) | Interaction (`interactive`) |
|---|---|---|
| `linear-actuator` | `cycle` extend, dwell, retract; `breathe` continuous sine; `static` | Drag the rod along its stroke; arrows step 5%, Home/End park it. `onExtensionChange` |
| `servo-motor` | `sweep` ±90°; `step` quarter-turn indexing with dwell; `hunt` the small hunting wobble around zero; `static` | Drag anywhere around the hub to aim the horn; arrows 5°, shift 15°. `onAngleChange` |
| `rotary-table` | `index` station to station with dwell; `spin` continuous; `static` | Drag to spin the platter; click a fixture to index it to the pointer; arrows index by one. `onAngleChange`, `onStationChange` |
| `robot-gripper` | `cycle` open, close onto a part, hold, release; `flex` shallow breathing; `static` | Drag a jaw to set the opening; click toggles open and closed. `onOpeningChange` |
| `conveyor-belt` | already ran; unchanged | Drag the belt to scrub travel, release to resume. `onPositionChange` |
| `planetary-gearbox` | `run` turn the input continuously; `jog` index it in half-turn steps with a dwell; `static` | Drag round the centre to wind the shaft; arrows 10°, shift 30°. `onAngleChange` |
| `belt-drive` | `run` one way; `shuttle` back and forth; `static` | Drag the belt along its run; arrows a twentieth of a turn. `onTravelChange` |
| `cable-carrier` | `cycle` the full stroke with a dwell at each end; `creep` about the middle; `static` | Drag the carriage along its rail; arrows 5%. `onTravelChange` |
| `mecanum-wheel` | `roll` continuously; `crab` reversing each half cycle; `static` | Drag round the hub to spin it; arrows 10°. `onAngleChange` |
| `tool-changer` | `dock` approach, seat, lock, hold, release; `latch` work the lock with the halves seated; `static` | Drag the tool half up to the coupler; arrows 5%. `onEngagementChange` |
| `suction-gripper` | `cycle` down, seal, lift, place, release; `breathe` about the middle of the stroke; `static` | Drag the bar down onto the sheet; arrows 5%. `onDescentChange` |
| `robot-hand` | `grip` close onto the grasp and open again; `wave` ripple the digits one after another; `static` | Drag up and down to close it; click, Enter or Space steps the grasp. `onCurlChange`, `onGraspChange` |
| `robot-foot` | `step` roll through a stance then lift and carry back; `rock` heel to toe without leaving the floor; `static` | Drag left and right to roll it. `onRollChange` |
| `robot-leg` | `stride` walk the cycle; `squat` drop and rise on a planted foot; `kick` swing the foot through an arc; `static` | Drag the foot anywhere; the hip and knee solve to it. `onTargetChange` |
| `robot-torso` | `breathe` work the cage; `twist` wind the shoulders against the hips; `static` | Drag across to twist and up and down to lean. `onLeanChange`, `onTwistChange` |
| `robot-skeleton` | `walk`, `run`, `march`, `idle` stand and rock, `static` | Drag across to scrub the gait; arrow keys step it. `onPhaseChange` |
| `clamshell-laptop` | `open` lift, work, shut; `adjust` work the angle with it left open; `static` | Drag up the frame to lift the lid; arrows 5°, Shift 15°. `onLidChange` |
| `slate-tablet` | `prop` stand it up, hold, lay it back down; `sketch` the small range someone drawing uses; `static` | Drag the slate back; arrows 5%. `onReclineChange` |
| `wheel-player` | `scroll` a turn of the list a cycle; `seek` back and forth like a thumb hunting; `static` | Drag round the wheel; arrows one row. `onRotationChange`, `onRowChange`. `locked` takes all three away at once |
| `slab-handset` | `turn` right round so every face comes past; `nudge` the small range a hand does; `static` | Drag across the frame — the width is one revolution; arrows 10°, Shift 30°. `onTurnChange` |
| `wrist-terminal` | `dial` a turn of the crown a cycle; `pulse` the quarter turn a finger checking does; `static` | Drag round the face; arrows one detent. `onCrownChange` |
| `key-switch` | `tap` one whole keystroke a cycle; `flutter` the band round the actuation point, where the hysteresis stops it chattering; `hold`; `static` | Drag down the cap to press it; arrows 5%, shift 15%, Home/End up and bottomed out. `onPressChange`, and `onActuatedChange` when the contact itself changes |
| `robot-keypad` | `entry` work through the code and answer it; `scan` strobe the matrix with nothing pressed; `idle`; `static` | Drag across the face to scrub the entry; arrows a digit at a time. `onTypedChange`, `onEntryChange` |
| `robot-keyboard` | `type` the passage; `ripple` a self-test wave across the deck; `scan`; `idle`; `static` | Drag across the deck to scrub the passage; arrows a stroke at a time. `onTypedChange` |
| `input-terminal` | `session` set the head, type under it, lay it back; `query` type with the head parked; `idle` the cursor only; `static` | Drag down the frame to lay the head back; arrows 3°, shift 10°. It keeps typing while you hold it. `onCantChange` |
| `motion-platform` | `settle` the small continuous correction; `sway` the full six-axis excursion; `static` | Drag the deck to tip it — across for roll, up and down for pitch; arrows 4°. `onPoseChange` |
| `solenoid-valve` | `cycle` the full stroke; `pulse` pull, hold and release; `static` | Drag the plunger; arrows move 5%, Shift/Page 15%. `onPositionChange` |
| `electromagnetic-relay` | `switch` between rests with dwell; `pulse` energize, hold and release; `static` | Drag or toggle the armature; arrows move 5%. `onEnergizedChange` |
| `induction-motor` | `run` continuous rotation; `slip` a lagging rotor with a small load ripple; `static` | Wind the cage rotor; arrows turn 5°. `onAngleChange` |
| `stepper-motor` | `step` index with dwell; `run` advance continuously through integer indices; `static` | Wind or arrow between rotor steps. `onStepChange` |
| `voice-coil-actuator` | `oscillate` across the gap; `pulse` run a bidirectional impulse; `static` | Drag along the travel axis; arrows move 0.1. `onPositionChange` |
| `magnetic-bearing` | `balance` make small corrections; `disturb` cross most of the air gap; `static` | Displace the rotor on the selected axis; arrows move 0.1. `onOffsetChange` |
| `eddy-current-brake` | `brake` move from clear to full overlap; `feather` work around half overlap; `static` | Move the magnet array across the disc; arrows move 5%. `onEngagementChange` |
| `maglev-carriage` | `shuttle` traverse the stator; `hover` make small centre corrections; `static` | Drag along the stator; arrows move 5%. `onTravelChange` |
| `magnetic-gripper` | `pick` energize, capture, lift and release; `hold` stay energized; `static` | Scrub field strength; arrows move 5%. `onStrengthChange` |
| `inductive-sensor` | `approach` traverse the sensing envelope; `inspect` hover near threshold; `static` | Drag the target; arrows change distance 5%. `onDistanceChange` |
| `resolver` | `turn` rotate continuously; `sweep` traverse a bounded shaft arc; `static` | Wind the rotor; arrows turn 5°. `onAngleChange` |
| `transformer-core` | `alternate` scrub a full electrical cycle; `pulse` reverse each half cycle; `static` | Scrub phase; arrows move 5%. `onPhaseChange` |
| `robot-rover` | `patrol` a heading loop with the treads rolling in proportion; `wander` a drifting heading; `pointer` turn toward the cursor; `static` | Pointer steering, plus click to toggle the lamps. `onHeadingChange` |
| `robot-drone` | `hover` bob and yaw drift; `orbit` a circle with bank; `pointer` fly at the cursor; `static`. Rotors spin whenever anything else does | Pointer flight; click toggles the lamp. `onHeadingChange` |
| `lidar-scan` | `sweep` the ray around, returns lighting as it passes and fading behind it; `pointer` aim the ray; `static` | Hover a return to read its angle and distance. `onSampleHover` |
| `micro-duck` | `walk` the gait cycle; `idle` weight shift and the odd blink; `peck` a feeding loop; `static` | Gaze tracks the pointer; click quacks — a beak snap and head bob that decays. `onQuack` |
| `reachy-mini` | `idle` breathing sway and heave; `scan` a yaw sweep; `nod`; `static` | Head yaw and pitch follow the pointer, not just the pupils; click nods once. `onNod` |
| `robot-quadruped` | `walk`, `trot`, `idle` breathing, `static` | Hover and it notices you and starts walking; click toggles sit and stand. `onGaitChange` |
| `robot-fish` | `cruise` steady beat; `dart` burst-and-glide; `hover` fin-holding with a slack body; `static` | Turns toward the pointer; click darts — a swing and speed spike that decays. `onDart` |
| `robot-snake` | `serpentine` even wave; `sidewind` alternating sections lifted clear; `coil` curled and breathing; `static` | The head turns toward the pointer; click strikes and recovers. `onStrike` |
| `robot-spider` | `walk` tripod gait; `skitter` fast ripple; `idle` a stance breath; `static` | Faces the pointer and walks while watched; click drops it into a crouch. `onCrouchChange` |
| `robot-crab` | `scuttle` sideways runs that reverse; `idle` claw display; `static` | Eyestalks track the pointer; click snaps both claws. `onSnap` |
| `robot-bird` | `perch` settling bob and head turns; `flap` the full beat; `glide` wings held with tail trim; `static` | Head tracks the pointer; click launches it into a burst that settles back. `onTakeoff` |
| `utility-droid` | `work` turn to the bench, run the tool out, hold, stow; `scan`; `idle`; `static` | The dome is its attention: it turns to the pointer and goes back to work when you leave |
| `casing-droid` | `patrol` hold a bearing, swing to the next, hold; `survey`; `idle`; `static` | The eyestalk follows the pointer |
| `probe-droid` | `hover` ride the repulsors; `scan` hold height and sweep the sensor; `pointer`; `static` | The sensor comes round to the pointer |
| `medical-droid` | `diagnose` ramp the readout to a result and hold it; `monitor`; `idle`; `static` | Head tracks the pointer; a click runs the scan again. `onDiagnosticRestart` |
| `infantry-droid` | `patrol` march and look about; `alert` stand to guard and scan; `idle`; `static` | Head tracks the pointer; a click puts it on guard. `onPoseChange` |
| `protocol-droid` | `converse` work through its gestures a beat at a time; `idle`; `static` | A click moves the conversation on a gesture. `onGestureChange` |
| `courier-droid` | `deliver` straight legs and square corners; `patrol`; `pointer`; `static` | It comes round to face the pointer |
| `robot-arm`, `scara-arm`, `delta-arm`, `gantry-arm` | unchanged: `pointer`, `orbit`, `sweep`, `idle`, `static` | Press and drag the tip anywhere in the frame — direct manipulation, and the only way these work on touch. Release resumes the behavior. `onTargetChange` |
| `casing-droid` | `patrol` hold a bearing, swing, hold again; `survey` sweep the room; `idle` drift; `static` | The eyestalk comes round to the pointer. |
| `astromech-droid` | `work` turn to the socket, open the panel and project; `roam` sweep and rock; `idle`; `static` | The dome turns to the pointer. |
| `attendant-droid` | `attend` work the room a courtesy at a time; `fret` alarm and apology; `idle`; `static` | Head to the pointer; click steps to the next pose. `onPoseChange` |
| `cyber-trooper` | `march` step and spend the reserve, then halt and recharge; `advance` march and reach; `idle` trickle charge; `static` | Head to the pointer; click cuts the power, click again restores it. `onPowerChange` |
| `custodian-droid` | `watch` armour seated, station-keeping, drifting round a bearing; `survey` half out and breathing while it turns through the room; `alert` shell wide, tight fast float, the voice ring bursting; `static` | Drag across it to run the armour out and in; arrows 10%, shift 25%, Home/End seated or wide. The optic tracks the pointer. `onOpenChange` |
| `robot-hound` | `seek` cast the head across the ground ahead; `alert` hold it up with a tremor; `idle` settle back onto the skirt; `static` | Drag up and down to bring its head up; arrows 10%, shift 25%, Home stows and End alerts. The head turns to the pointer throughout. `onAttentionChange` |
| `robot-horse` | `walk` four beats in a lateral sequence with the neck nodding once per foreleg; `trot` two on diagonals with a suspension; `canter` three on a lead; `gallop` four; `graze` halted with the head down; `static` | Drag across to scrub the stride one footfall at a time — the frame is one whole cycle; arrows 5%, shift 15%, Home parks it and End hands it back. The head tracks the pointer. `onPhaseChange` |
| `robot-pegasus` | `launch` canter, gather, and hand the weight over; `canter` on the floor with the wings furled; `soar` wings held and legs tucked; `hover` on the wings alone at a fast beat; `static` | Drag up and down to work the handover — the frame's height is the whole of it; arrows 10%, shift 25%, Home on the floor and End in the air. `onLiftChange` |
| `robot-camel` | `pace` the lateral two-beat and the roll that falls out of it; `walk`; `trot` the diagonal control case; `couch` folded down; `static` | Drag up and down to work the ground — firm at the top, soft at the bottom, so dragging down is sinking; arrows 10%, shift 25%, Home on rock and End in sand. `onGroundChange` |
| `robot-avocado` | `present` open, hold the stone up, shut; `ajar` a crack, breathing; `scan` half open with the optic working the room; `static` | Drag either way out of the middle to part the shell; arrows 10%, shift 25%, Home/End shut and wide. `onOpenChange` |
| `robot-strawberry` | `unfurl` open, work, furl again; `probe` work the middle with the studs never seated; `furl` shut bar the two moments it cracks; `static` | Drag up and down to work the calyx; arrows 5%, shift 15%, Home/End furled and splayed. `onBloomChange` |
| `robot-tomato` | `sway` a slow pendulum; `settle` a knock swinging itself off; `sort` over to one side and held to be picked; `static` | Drag across to swing it under its clamp — it follows the pointer from every camera; arrows 5°, shift 15°, Home plumb and End hard over. `onSwingChange` |
| `bellows-droid` | `breathe` a slow sine; `settle` fill over three quarters of the cycle and dump in the last quarter; `startle` sit full and lose most of it twice a cycle; `static` | Drag the shell up and down to fill it; arrows 5%, shift 15%, Home/End flat or full. `onInflationChange` |
| `sentinel-console` | `watch` hold a bearing, swing to the next, hold again; `listen` iris wide and the optic all but still; `speak` the grille running an envelope; `alert` iris stopped down and pulsing, optic snapping between bearings; `static` | Drag across the lens to work the iris; arrows 5%, shift 15%, Home/End closed or wide. The optic tracks the pointer throughout. `onApertureChange` |
| `robot-sunflower` | `sweep` the working arc, which is the part of the day a collector collects in; `day` the whole twenty-four hours, so the head turns away and the rays furl at night; `nod` the hunting a tracker does once it has arrived; `static` | Drag across it to scrub the day; arrows 3%, shift 10%, Home dawn and End dusk. With `track` on, the light is the pointer and the head, the mast and the leaf panels all come round to it. `onDaylightChange` |
| `celestial-planet` | `rotate` turn it; `orbit` walk the light round with it so the phase changes; `tumble` carry the pole round at a different rate; `static` | Drag across the globe to turn it; arrows 10°, shift 30°. `onSpinChange` |
| `celestial-moon` | `cycle` the lunation; `libration` held near full, where the rocking is all there is left to see; `static` | Drag across it to scrub the lunation; arrows 2.5%, shift an eighth, Home new and End full. `onPhaseChange` |
| `celestial-star` | `flare` grow a loop over half the cycle and let it fall back; `rotate` hold the surface and turn it; `pulse` work the radius as well as the activity; `static` | Drag across it to work the activity; arrows 5%, shift 15%. `onActivityChange` |
| `celestial-asteroid` | `tumble` and `spin` turn it at different rates; `drift` barely turns it; `static` | Drag across it to turn it; arrows 10°, shift 30°. `onTumbleChange` |
| `orrery` | `run` wind time on continuously; `jog` index a year at a time with a dwell; `static` | Drag across it to wind time on — the full width is twenty-four years; arrows a quarter of a year, shift a whole one. `onEpochChange` |
| `battle-station` | `detonate` runs the hull apart and back; `charge` winds the dish up and fires; `patrol` just turns it; `static` | Drag across it to take the breakup; arrows 5%, shift 15%, Home intact and End apart. `onBreakupChange` |
| `debris-field` | `drift` holds the scatter and lets the tumble carry it; `burst` runs the scatter out and back; `tumble` holds it further out; `static` | Drag across it to scrub the scatter; arrows 5%, shift 15%, Home assembled and End apart. `onSpreadChange` |
| `robot-face` | unchanged tracking and blink, plus an idle gaze drift when the pointer is away | Click to poke: a squint and antenna flick. `onPoke` |
| `robot-loader` | unchanged cycle | `pauseOnHover` stops the cell under the pointer |
| `robot-arm-3d` | unchanged | Press-drag on the canvas aims the tip, so touch reaches it too |
| `robot-stage` | `autoRotate` unchanged | `pauseOnInteraction` stops the auto-rotate while the pointer is down |

Stock shadcn primitives (`button`, `card`, `switch`, …) keep the animation they ship
with; they are not robocn's to redraw.

## Accessibility

Anything draggable is also a `role="slider"` with `tabIndex=0`, `aria-valuemin`,
`aria-valuemax`, `aria-valuenow` and `aria-valuetext`, so the same value is
reachable from the keyboard and readable by a screen reader. Components that are
not interactive keep `role="img"` and their descriptive label. A reduced-motion
preference parks every internal loop; it never disables interaction, because that
is input rather than decoration.

## Verification

- `vitest`: the hook's pure helpers (`approach`, `arrowStep`, clock parking),
  behavior sampling per machine at fixed phases, drag-to-value mapping through
  synthetic pointer events, and the controlled-wins rule for each component that
  gained one.
- `tsc --noEmit`, `eslint`, `next build`.
- Driven in a browser: every docs page, each behavior switched through, each
  machine grabbed with a mouse and with a touch emulation, and reduced-motion
  forced on to confirm the loops park.
