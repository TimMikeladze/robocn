import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

/**
 * Re-reads the library from disk.
 *
 * A brand new machine is a file before it is a registry item, and the control
 * manifest is a build step — so without this, creating a robot means restarting
 * the dev server to see it. This runs the same generator `pnpm generate` runs;
 * it writes into `src/`, which Fast Refresh picks up, so the new draft appears
 * on the next render.
 *
 * It is a local development convenience and nothing else: it refuses on a
 * production build and refuses a request that did not come from this machine.
 * No part of the request reaches the command — there are no arguments to pass.
 */
export const dynamic = "force-dynamic"

const loopback = (host: string | null) =>
  Boolean(host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Rescanning reads the working directory, so it only runs on a dev server." },
      { status: 403 },
    )
  }
  if (!loopback(request.headers.get("host"))) {
    return Response.json({ error: "Rescanning is available on this machine only." }, { status: 403 })
  }
  try {
    const { stdout } = await run("node", ["scripts/build-workbench.mjs"], {
      cwd: process.cwd(),
      timeout: 60_000,
    })
    return Response.json({ message: stdout.trim() })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `The scan failed: ${error.message.split("\n")[0]}`
            : "The scan failed.",
      },
      { status: 500 },
    )
  }
}
