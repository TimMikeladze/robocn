// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { runAgent, type AgentEvent } from "../agent"
import { POST } from "@/app/api/builder/generate/route"
import { POST as compilePost } from "@/app/api/builder/compile/route"

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const request = (body: unknown, headers = {}) => new Request("http://localhost/api/builder/generate", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })
const response = (code: string) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ code, name: "test-robot", explanation: "A new test robot." }) }] }] })

describe("agent iteration", () => {
  it("repairs a compiler error using feedback, then returns the actual compiled component", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response('export default function Robot(){return <div>broken}'))
      .mockResolvedValueOnce(response('export default function Robot(){return <svg role="img" aria-label="New robot"><circle cx="20" cy="20" r="10" /></svg>}'))
    vi.stubGlobal("fetch", fetcher)
    const events: AgentEvent[] = []
    await runAgent({ prompt: "Make a new robot", code: "", error: "", apiKey: "test-key" }, e => events.push(e), new AbortController().signal)
    expect(fetcher).toHaveBeenCalledTimes(2)
    const second = JSON.parse(fetcher.mock.calls[1][1].body)
    expect(second.input.at(-1).content).toContain("compiler errors")
    expect(second.store).toBe(false)
    expect(events.at(-1)?.type).toBe("result")
    expect(events.some(e => e.type === "status" && e.message.includes("Repairing"))).toBe(true)
  })
  it("reports authentication failures without exposing a key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })))
    await expect(runAgent({ prompt: "robot", code: "", error: "", apiKey: "secret" }, () => {}, new AbortController().signal)).rejects.toThrow("key was rejected")
  })
  it("refuses incomplete model output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "incomplete", output: [] })))
    await expect(runAgent({ prompt: "robot", code: "", error: "", apiKey: "secret" }, () => {}, new AbortController().signal)).rejects.toThrow("did not finish")
  })
})

describe("builder endpoints", () => {
  it("rejects cross-origin and oversized requests", async () => {
    expect((await POST(request({ prompt: "robot", code: "" }, { Origin: "https://evil.example" }))).status).toBe(403)
    expect((await POST(request({ prompt: "x".repeat(100_001), code: "" }))).status).toBe(413)
  })
  it("does not allow anonymous spending of a production server key", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("OPENAI_API_KEY", "secret"); vi.stubEnv("BUILDER_ACCESS_TOKEN", "")
    expect((await POST(request({ prompt: "robot", code: "" }))).status).toBe(401)
  })
  it("requires the configured access token", async () => {
    vi.stubEnv("OPENAI_API_KEY", "secret"); vi.stubEnv("BUILDER_ACCESS_TOKEN", "correct")
    expect((await POST(request({ prompt: "robot", code: "" }, { "x-builder-token": "wrong" }))).status).toBe(401)
  })
  it("streams a successful generation using a visitor's key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('export default function Robot(){return <svg aria-label="Generated" />}')))
    const res = await POST(request({ prompt: "robot", code: "" }, { "x-openai-key": "visitor-key" }))
    expect(res.status).toBe(200)
    const events = (await res.text()).trim().split("\n").map(line => JSON.parse(line))
    expect(events.at(-1).type).toBe("result")
    expect(events.at(-1).javascript).toContain("__Robot")
  })
  it("returns diagnostics for source that cannot compile", async () => {
    const res = await compilePost(request({ code: "export default () => <broken" }))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain("Line")
  })
})
