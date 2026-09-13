# Robot builder

`/builder` is a browser workspace for creating and evolving real robocn React components.
The landing page and site navigation link to it. Every visual component's docs page has an
**Open in builder** link; `/builder?component=robot-drone` opens that component directly.

## Working with the library

**Load from library** searches every `registry:ui` item in `registry.json`. Loading one
copies its complete source into the editor, preserving its existing imports, geometry,
props, and behavior. It does not modify the installed component. Previous drafts remain
in version history. The 3D components and teach pendant include a small preview harness;
lidar includes explicitly illustrative samples. All of this code is editable.

The source editor can run without an API key. Change React, press **Run preview**, and
the server compiles it against the actual bundled library. Drawing, view, palette, and
pause controls pass props to the component; a control only affects components supporting
that prop. The preview includes the site's generated CSS for existing Tailwind components.

## Agent connection

Choose **Connect agent** and enter an OpenAI API key. It is held only in tab memory, never
localStorage or the preview, and sent to the same-origin server which calls OpenAI's
Responses API. Generation requires API credits. Code, messages, and the last twelve
versions are saved locally in the browser; keys are not. Clearing browser storage removes
these drafts. Download valuable work.

Alternatively configure the Node server:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5.4
BUILDER_ACCESS_TOKEN=your-private-builder-token
```

`OPENAI_MODEL` is optional. In local development a configured server key can be used
directly. In production a server key requires `BUILDER_ACCESS_TOKEN`; visitors enter that
token in connection settings. Visitors can also use their own API key. Secrets must not
use the `NEXT_PUBLIC_` prefix.

The agent receives the current source, user request, latest preview error, and the
library's actual exports, types, drawing helpers, and motion implementation. It returns a
complete component, compiles it, and can repair compilation failures up to twice. Runtime
errors are displayed with **Repair with agent**. Stop cancels the client request and
propagates cancellation upstream. Generation never changes repository files.

## Export

Download TSX or use **Export registry** after successful compilation. A registry download
includes the source and detected robocn/npm dependencies. Host that JSON to install by
URL with shadcn, or install it from a local path. Robocn dependencies use the builder's
origin, so use an accessible deployment when sharing exports. The JSON is a draft item,
not an automatically published addition to this repository. Generated components still
need normal semantic review, tests, and documentation before publication.

## Runtime and deployment

Run `pnpm dev` or `pnpm build`. Both run `pnpm builder:prepare`, which creates
`public/builder-runtime.js`, `public/builder-runtime.css`, and the server-only module
catalogue at `src/lib/builder/generated.json`. These generated files are ignored by Git.
Re-run preparation after changing library sources during an existing dev session.
The test and typecheck scripts also prepare the runtime for a clean checkout.

The same implementation works locally and on a Node-capable Next.js deployment. It is
not a static export. Generation allows up to 300 seconds; hosting timeout limits still
apply. No external sandbox service is required. The compiler uses esbuild as an external
Node dependency; its platform binary must be installed during deployment.

User code is never executed on the server. The compiler resolves only known virtual
modules, not filesystem paths or remote modules. The browser executes it in an iframe
with `sandbox="allow-scripts"` and without same-origin access; CSP blocks outbound
connections, nested frames, and form submission. Messages from the preview are accepted
only from its own window. This isolates data access, not CPU usage: pathological code can
still exhaust browser resources. Use infrastructure request limits before operating a
high-traffic public compiler service.

## Verification

`src/lib/builder/__tests__` checks every registered visual component against its original
source and compiles each sandbox entry point. Tests also exercise import isolation,
compiler diagnostics, generation/repair with mocked model responses, request size/origin
validation, and access-token requirements. Model credentials are needed separately for a
live provider smoke test.

API format reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
Compiler reference: [esbuild plugins](https://esbuild.github.io/plugins/).
