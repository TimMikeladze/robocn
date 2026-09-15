# Exporting a machine as a picture

Every component here is a *drawing that moves*. A still PNG throws the moving half away, and
the only way anyone could previously put a robocn machine in a README, a slide or a Slack
message was to run a screen recorder against it. This is the export path: **any machine, any
pose, any stage — recorded in the browser and downloaded as an animated WebP, an animated
GIF, or a still.**

No server, no ffmpeg, no dependency. The page already has the pixels; the work is getting
them out of the DOM and into a container.

## What ships

| Item | Type | What it is |
|---|---|---|
| `robot-capture` | lib | DOM → frames → bytes. A style-baking snapshotter, a GIF89a encoder and an animated-WebP muxer, all dependency-free. |
| `robot-export` | ui | The control: a wrapper that puts a record button over a machine, and the same menu as a standalone control for a toolbar. |

Three files behind the lib, because they are three unrelated problems:

```
src/lib/robocn/capture.ts   DOM → <svg> snapshot → canvas frames, with real frame deltas
src/lib/robocn/gif.ts       RGBA frames → GIF89a: median cut, nearest-colour map, LZW
src/lib/robocn/webp.ts      per-frame WebP files → one animated WebP: RIFF/VP8X/ANIM/ANMF
```

## The hard part is not the encoder, it is the snapshot

A robocn machine is an `<svg>` whose colours are `var(--robot-shell, …)`, whose text
inherits the page's font, and whose sparks are CSS keyframes. Serialize that element and
hand it to an `Image` and you get the *fallback* palette on a transparent field with no
animation — a different drawing than the one on screen. So the snapshotter bakes:

- **Custom properties and `currentColor`.** Walk the live tree and the clone together and
  copy *computed* `fill`, `stroke`, `stop-color`, `color`, `opacity`, dash arrays and font
  properties onto the clone. `var()` and `currentColor` are resolved by the cascade that is
  still standing, not by the orphan copy.
- **Only what differs.** Inherited properties are compared against what the parent already
  emitted, and non-inherited ones against their initial value, so a 900-element robot emits
  a few hundred declarations rather than twenty thousand. Markup size is the frame budget:
  every frame is re-serialized, re-encoded as a data URL and re-decoded.
- **CSS animation, frozen at the instant of the sample.** `transform`, `opacity` and `fill`
  are read off an element whose computed style is mid-keyframe, so `robocn-spin` and
  `robocn-spark` land in the recording rather than sitting still. That is the only way they
  could: the clone has no stylesheet.
- **`<canvas>`, including WebGL.** Each live canvas is read with `toDataURL` and swapped
  into the clone as an `<image>`, which is why `robot-stage` now asks for
  `preserveDrawingBuffer` — without it a three.js canvas reads back empty.
- **Fonts.** `@font-face` rules from same-origin stylesheets are fetched once per session,
  base64'd and inlined, so text in an HTML capture is the typeface on screen. Two things
  make that work that did not at first: the rules are collected *recursively*, because
  Tailwind puts the whole sheet inside `@layer`; and each URL is resolved against **the
  stylesheet**, not the document — Next writes `../media/…`, which is a 404 against the page
  and the real file against the sheet. Get either wrong and the export comes out in serif.

HTML targets — a demo panel with its controls, the workbench stage with its grid, a whole
matrix — go through the same machinery wrapped in a `<foreignObject>`, with a curated set of
layout and paint properties copied so the clone lays itself out the same way.

One rule that is not a preference: a pure SVG snapshot is handed to the `Image` as a **blob
URL**, which is faster to make and faster to decode, but a document carrying a
`<foreignObject>` is handed a **data URL**. Chrome taints the canvas when a foreignObject
SVG arrives over `blob:` — and a tainted canvas cannot be read back at all, so `toBlob`
throws and there is no export. The identical document over `data:` is clean.

## Timing is recorded, not assumed

Serializing, encoding and decoding a frame costs tens of milliseconds, so a "15 fps" capture
is not 15 fps. Rather than drop frames to hit a nominal rate, the recorder timestamps every
frame and writes **the deltas it actually measured** into the container. A recording plays
back at the speed the machine really moved, and a slow frame shows up as a slightly longer
frame rather than as a speed-up. Deltas are clamped to the 10 ms floor both formats share.

The first frame is not the first capture: a throwaway frame runs first, so the font fetch and
the first layout are not charged to frame one — otherwise every loop opened on a held still.

A backgrounded tab is the honest failure. Chrome stops painting it and clamps its timers to a
second, so frames come a second apart and the machine is frozen between them: the file is
still written, and its measured delays say plainly that it was recorded at one frame a
second. The menu says to keep the tab in front while recording, which is the fix.

## GIF

`gif.ts` is a complete GIF89a writer: median-cut quantization on a 5-bit histogram, a
nearest-colour cache keyed by that 15-bit index, LZW with dictionary resets, a per-frame
local colour table, and the NETSCAPE 2.0 block for looping.

Choices worth naming:

- **Per-frame local palettes**, not one global table. These drawings are flat vector art
  with few colours; a local table is both smaller and exact, and there is no dithering to
  make it flicker.
- **No dithering.** Flat fills quantize perfectly; error diffusion would add noise that costs
  bytes and looks worse.
- **Transparency is a palette slot.** A frame with translucent pixels reserves index 0 and
  uses disposal 2 (restore to background) so frames do not stack up. An opaque recording
  uses disposal 1 and all 256 slots.

## WebP

There is no `VideoEncoder` for WebP and no encoder worth shipping in TypeScript — but the
browser already has one. `canvas.toBlob("image/webp")` produces a complete single-image WebP
file, and an animated WebP is exactly those frames' payload chunks re-housed:

```
RIFF …. WEBP
  VP8X  canvas size, ANIMATION flag (+ ALPHA if any frame carries one)
  ANIM  background colour, loop count
  ANMF  x, y, w, h, duration, flags, then that frame's own ALPH/VP8/VP8L chunks verbatim
  ANMF  …
```

So the muxer never touches a pixel: it parses each frame file's chunk list, drops the
container, and re-emits the chunks inside a frame header. Only the picture chunks go in:
`ALPH`, `VP8 `, `VP8L`. Chrome writes an `ICCP` colour profile into every WebP it encodes,
and that is a *file-level* chunk — copied into the frames it produces a file libwebp rejects
outright as a corrupt header, which is exactly what the first working export did. The
profile is hoisted to the top of the animation instead, where the format wants it. Encoding quality is the browser's,
the file is a fraction of the GIF, and every current browser plays it.

A still export is the same call with one frame and no muxing — a plain WebP or PNG.

## The control

`RobotExport` wraps anything and floats a record button over its top-right corner:

```tsx
<RobotExport name="robot-arm">
  <RobotArm behavior="sweep" />
</RobotExport>
```

The button opens the menu, and **every number in it is typed rather than picked**. The chips
are shortcuts to values the field beside them would take anyway:

| Field | Range | What it is |
|---|---|---|
| Seconds | 0–120 | Length of the recording. Zero is a still, and so is any length in PNG. |
| Rate | 1–60 fps | What the sampler aims for. What lands in the file is what was measured. |
| Frames | 1–900 | The same recording counted the other way: 90 frames at 30 fps *is* three seconds, and the field you did not touch follows. |
| Scale | 0.1–8× | Device pixels per CSS pixel. The readout says what that comes to in real pixels. |
| Quality | 1–100% | WebP only — the browser's encoder setting. |
| Loop | 0–65535 | Repeats. Zero is forever. |
| Ground | page / none / colour | The page's own background, no background at all, or a colour you name. |
| Name | — | The file stem. The extension is the format's. |

So 7.5 seconds at 24 fps scaled 1.75× on `#101014` is as available as the two-second
default. Arrow keys step a field, a value outside the range snaps to it when the field is
let go, and the ranges themselves are a prop — `limits={{ fps: [1, 120], frames: 2000 }}`
raises them, `presets` replaces the chips or removes them.

Those ceilings exist to stop a typo asking for a hundred thousand frames, not to have an
opinion: a recording that asks for more frames than the cap is shortened, and the menu says
so rather than quietly recording something else.

Recording shows progress on the button and the finished file — name, frames, pixel size,
bytes — in the menu. Nothing is uploaded; the file is a blob URL and an anchor click.

`ExportMenu` is the same menu without the wrapper, for a toolbar that already has a target:
hand it a ref and a name. That is what the workbench uses.

## Somewhere other than the downloads folder

The way out of a page is not always the browser's download. `exportNode` takes a `save`
callback — it defaults to `download`, and anything else that can take a `Blob` and a name
can have it instead:

```tsx
<ExportMenu
  target={stageRef}
  name="robot-arm"
  destinations={[
    { id: "download", label: "Download" },
    { id: "repo", label: "Folder", write: async (blob, file) => {
      await checkout.write(`docs/screenshots/${file}`, blob)
      return `docs/screenshots/${file}`
    } },
  ]}
/>
```

One destination is used silently; more than one becomes a row in the menu. The workbench
adds the second when it is holding a folder, so a recording lands in `docs/screenshots`
where a screenshot of a machine was headed anyway — see `docs/checkout.md`. The component
itself knows nothing about directory handles; it takes a callback.

## Where it is in the UI

- **Every docs page.** `DemoPanel` wraps its bench, so all 198 items have an export button
  on their own page without a per-item edit.
- **The workbench.** The toolbar's lone PNG button is now the full menu (`e`), and its target
  is the stage — so it records the machine, the background, the zoom, and the whole matrix
  when matrix mode is on. With a folder open it offers to write into the checkout.
- **The landing hero**, because that arm is the one people want as a GIF first.

## Limits, stated plainly

- A capture is a picture of the DOM, so anything not in the DOM is not in it: a native
  scrollbar, a portalled popover, the browser's own focus ring.
- Cross-origin images and cross-origin stylesheets cannot be inlined and are dropped rather
  than tainting the canvas.
- Recording is real time: a 4 s capture takes at least 4 s, and the tab must stay visible —
  a backgrounded tab throttles `requestAnimationFrame` and the machine stops moving.
- GIF is limited to 256 colours per frame by the format. Gradient-heavy machines belong in
  WebP.
