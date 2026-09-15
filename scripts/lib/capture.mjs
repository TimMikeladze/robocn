/**
 * The browser driver behind `pnpm og` and `pnpm shots`.
 *
 * Headless Chrome over the DevTools protocol: launch it, drive one page, clip a
 * PNG out of it. Both capture scripts are thin wrappers over this module — the
 * reasoning for driving DevTools rather than Chrome's `--screenshot` flag, and
 * for rendering at 2x and downsampling with `sips`, is in `docs/og-image.md`.
 *
 * macOS + Google Chrome only. Maintainer tooling; nothing here runs in a build.
 */

import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import net from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

/** Rendering at 2x and resampling once keeps the hairlines and the 10px mono. */
export const SCALE = 2

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** `--flag value`, `--flag=value`, and `--flag` on its own (true). */
export function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const [flag, inline] = arg.slice(2).split("=")
    parsed[flag] = inline ?? (argv[i + 1]?.startsWith("--") ? true : argv[++i])
  }
  return parsed
}

export const run = (cmd, cmdArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: "inherit", ...options })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    )
  })

/**
 * The next free port from `start`. Never take one that is in use: a server the
 * user already has running is theirs, not ours to reclaim. No host on the
 * probe — Next binds `::`, so a port free only on 127.0.0.1 is not free.
 */
export async function freePort(start) {
  for (let port = start; port < start + 50; port += 1) {
    const open = await new Promise((resolve) => {
      const server = net.createServer()
      server.once("error", () => resolve(false))
      server.once("listening", () => server.close(() => resolve(true)))
      server.listen(port)
    })
    if (open) return port
  }
  throw new Error(`no free port between ${start} and ${start + 50}`)
}

/**
 * Polls `url` until it answers. `anyStatus` takes a 500 as an answer: a route
 * that is failing to compile still proves a server is listening, and the
 * caller's own error is more use than a timeout.
 */
export async function waitFor(url, timeoutMs, { anyStatus = false } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (anyStatus || response.ok) return
    } catch {
      // Not up yet.
    }
    await wait(500)
  }
  throw new Error(`${url} did not answer within ${timeoutMs}ms`)
}

/**
 * The dev server the user already has running, if it answers. `next dev` writes
 * its port to this lock and refuses to start a second server for the same
 * directory, so reusing it is both the polite path and the only one that works
 * while the app is up.
 */
async function runningDevServer(probePath) {
  try {
    const { port } = JSON.parse(await readFile(".next/dev/lock", "utf8"))
    // Any answer, not only a 2xx, and long enough for the route's first
    // compile. A server that is up but serving a 500 is still the one to
    // capture from — `next dev` will not start a second for this directory, so
    // walking past it here fails the whole run on a port clash instead of
    // reporting the route that is actually broken.
    await waitFor(`http://localhost:${port}${probePath}`, 30_000, { anyStatus: true })
    return port
  } catch {
    return null
  }
}

async function startDevServer(probePath) {
  const port = await freePort(3100)
  console.log(`→ next dev on :${port}`)
  const server = spawn("pnpm", ["exec", "next", "dev", "--port", String(port)], {
    stdio: ["ignore", "ignore", "inherit"],
  })
  const died = new Promise((_, reject) => {
    server.on("exit", (code) => reject(new Error(`next dev exited ${code}`)))
  })
  // The first request is also the route's first compile, so allow for it.
  await Promise.race([waitFor(`http://localhost:${port}${probePath}`, 180_000), died])
  return { port, stop: () => server.kill("SIGTERM") }
}

/**
 * An origin to capture from: the one named on the command line, the dev server
 * already up, or one we boot and own. `stop()` only kills a server we started.
 */
export async function resolveOrigin(explicit, probePath = "/") {
  if (explicit) return { origin: explicit.replace(/\/$/, ""), stop: () => {} }
  const running = await runningDevServer(probePath)
  if (running) {
    console.log(`→ reusing next dev on :${running}`)
    return { origin: `http://localhost:${running}`, stop: () => {} }
  }
  const server = await startDevServer(probePath)
  return { origin: `http://localhost:${server.port}`, stop: server.stop }
}

/** The thinnest DevTools protocol client that can drive one page. */
class Devtools {
  constructor(socket) {
    this.socket = socket
    this.nextId = 0
    this.pending = new Map()
    this.waiters = []
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data)
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (!entry) return
        if (message.error) entry.reject(new Error(message.error.message))
        else entry.resolve(message.result)
        return
      }
      this.waiters = this.waiters.filter((waiter) => {
        if (waiter.method !== message.method) return true
        waiter.resolve(message.params)
        return false
      })
    })
  }

  static async open(url) {
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true })
      socket.addEventListener("error", () => reject(new Error(`cannot reach ${url}`)), {
        once: true,
      })
    })
    return new Devtools(socket)
  }

  send(method, params = {}, sessionId) {
    const id = (this.nextId += 1)
    this.socket.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  once(method) {
    return new Promise((resolve) => this.waiters.push({ method, resolve }))
  }

  close() {
    this.socket.close()
  }
}

/**
 * `webgl` swaps `--disable-gpu` for a software rasteriser. Headless Chrome has
 * no GPU, so without it every react-three-fiber canvas captures as an empty
 * panel — which is how the first contact sheet came out with two blank tiles.
 * It is opt-in because it is slower and changes nothing for pages that are all
 * SVG, and the committed `og.png` should not move for a flag it does not use.
 */
async function launchChrome(profile, { webgl = false } = {}) {
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    ...(webgl
      ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : ["--disable-gpu"]),
    "--hide-scrollbars",
    "--disable-lcd-text",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "about:blank",
  ])
  // Chrome writes the port it actually took on the first line of this file.
  const portFile = path.join(profile, "DevToolsActivePort")
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).split("\n")
      if (port) {
        const { webSocketDebuggerUrl } = await (
          await fetch(`http://127.0.0.1:${port}/json/version`)
        ).json()
        return { chrome, webSocketDebuggerUrl }
      }
    } catch {
      // Chrome still starting.
    }
    await wait(150)
  }
  chrome.kill("SIGKILL")
  throw new Error("Chrome did not report a DevTools port")
}

/** One page in a launched browser. Everything a capture script needs to say. */
class Page {
  constructor(devtools, sessionId) {
    this.devtools = devtools
    this.sessionId = sessionId
  }

  send(method, params) {
    return this.devtools.send(method, params, this.sessionId)
  }

  viewport(width, height, scale = SCALE) {
    return this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    })
  }

  /**
   * Emulated media features. One call replaces the whole set, so a caller that
   * wants two of them has to name both.
   */
  media(features) {
    return this.send("Emulation.setEmulatedMedia", { features })
  }

  /** Belt and braces next to the saved theme: `system` resolves off this. */
  colorScheme(mode) {
    return this.media([{ name: "prefers-color-scheme", value: mode }])
  }

  async goto(url) {
    // Through `about:blank` first: navigating straight from a URL to itself is
    // not always a navigation, and the load event then never arrives.
    const blanked = this.devtools.once("Page.loadEventFired")
    await this.send("Page.navigate", { url: "about:blank" })
    await blanked
    const loaded = this.devtools.once("Page.loadEventFired")
    await this.send("Page.navigate", { url })
    await loaded
  }

  /** Polls for `selector`, since a route's own JavaScript may still be running. */
  async waitForSelector(selector, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const found = await this.evaluate(
        `document.querySelector(${JSON.stringify(selector)}) !== null`,
      )
      if (found) return true
      await wait(200)
    }
    return false
  }

  async evaluate(expression, awaitPromise = false) {
    const { result } = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    })
    return result?.value
  }

  /**
   * next/font is a stylesheet, so a wordmark renders in the fallback face until
   * the woff2 lands. Then give the page time to hydrate and settle a frame.
   */
  async settle(ms) {
    await this.evaluate("document.fonts.ready.then(() => true)", true)
    await wait(ms)
    // `next dev` mounts its indicator into a `<nextjs-portal>`. Nothing to
    // configure — just take it out.
    await this.evaluate(
      "document.querySelectorAll('nextjs-portal').forEach((node) => node.remove())",
    )
  }

  /**
   * Puts `selector` at the top of the viewport and returns the resulting
   * `scrollY` — which is also the clip origin, since `captureBeyondViewport`
   * clips in document coordinates rather than viewport ones. `null` if the
   * selector is not on the page: a shot that quietly photographs the wrong
   * thing is worse than one that fails, so callers treat that as fatal.
   */
  scrollTo(selector, offset = 0) {
    return this.evaluate(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - ${offset}, behavior: "instant" })
        return window.scrollY
      })()`,
    )
  }

  /** The box of `selector` in viewport coordinates, or null if it is not there. */
  box(selector) {
    return this.evaluate(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      })()`,
    )
  }

  /**
   * Rewrites every local origin in the page's text to `to`. The install lines
   * are built from `siteUrl`, which is baked from `NEXT_PUBLIC_REGISTRY_URL` at
   * build time — so a capture off a dev server prints a `localhost` URL as the
   * command a reader is meant to run, and not even the port it was served from.
   * Same reasoning as `productionUrl` on the social card; the DOM is the only
   * place to apply it when the server being captured is one the user already
   * had running. Returns how many nodes changed, so a caller can notice when
   * the shot it expected to fix had nothing to fix.
   */
  rewriteLocalHost(to) {
    return this.evaluate(
      `(() => {
        const pattern = /https?:\\/\\/(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?/g
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let count = 0
        while (walker.nextNode()) {
          const node = walker.currentNode
          if (!pattern.test(node.nodeValue)) continue
          pattern.lastIndex = 0
          node.nodeValue = node.nodeValue.replace(pattern, ${JSON.stringify(to)})
          count += 1
        }
        return count
      })()`,
    )
  }

  /** `clip` is in document coordinates: `captureBeyondViewport` ignores scroll. */
  async screenshot(file, clip) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, ...clip, scale: 1 },
    })
    await writeFile(file, Buffer.from(data, "base64"))
  }
}

/**
 * Launch Chrome, hand `fn` one page, and always tear the browser and its
 * throwaway profile down again.
 */
export async function withPage(fn, options = {}) {
  const profile = await mkdtemp(path.join(tmpdir(), "robocn-shot-"))
  const { chrome, webSocketDebuggerUrl } = await launchChrome(profile, options)
  let devtools
  try {
    devtools = await Devtools.open(webSocketDebuggerUrl)
    const { targetId } = await devtools.send("Target.createTarget", { url: "about:blank" })
    const { sessionId } = await devtools.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })
    const page = new Page(devtools, sessionId)
    await page.send("Page.enable")
    await page.send("Runtime.enable")
    return await fn(page)
  } finally {
    devtools?.close()
    chrome.kill("SIGTERM")
    await rm(profile, { recursive: true, force: true })
  }
}

/** A 2x capture resampled once, which is sharper than capturing at 1x. */
export async function downsample(raw, out, width, height) {
  await run("sips", ["-z", String(height), String(width), raw, "--out", out], {
    stdio: "ignore",
  })
}

export async function scratchDir() {
  return mkdtemp(path.join(tmpdir(), "robocn-raw-"))
}

export { rm }
