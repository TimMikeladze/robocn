import { timingSafeEqual } from "node:crypto"
import { runAgent, type AgentEvent } from "@/lib/builder/agent"
import { MAX_CODE_LENGTH } from "@/lib/builder/compiler"
import { errorResponse, readBody, RequestError } from "@/lib/builder/http"

export const runtime = "nodejs"
export const maxDuration = 300

function equal(a: string, b: string) {
  return Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request)
    if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 8000) throw new RequestError("Describe your robot in 1–8,000 characters.")
    if (typeof body.code !== "string" || body.code.length > MAX_CODE_LENGTH) throw new RequestError("Invalid component source.")
    if (body.error !== undefined && (typeof body.error !== "string" || body.error.length > 4000)) throw new RequestError("Invalid preview error.")
    const suppliedKey = request.headers.get("x-openai-key")?.trim()
    const accessToken = request.headers.get("x-builder-token") ?? ""
    let apiKey = suppliedKey
    if (!apiKey && process.env.OPENAI_API_KEY) {
      // Never expose a shared paid key as an anonymous public API.
      if (process.env.BUILDER_ACCESS_TOKEN) {
        if (!equal(accessToken, process.env.BUILDER_ACCESS_TOKEN)) throw new RequestError("Enter the builder access token in connection settings.", 401)
      } else if (process.env.NODE_ENV === "production") {
        throw new RequestError("Connect your own OpenAI key, or configure a builder access token on the server.", 401)
      }
      apiKey = process.env.OPENAI_API_KEY
    }
    if (!apiKey) throw new RequestError("Connect an OpenAI API key to start building. You can still edit and preview code without one.", 401)
    if (apiKey.length > 512) throw new RequestError("Invalid API key.")
    const controller = new AbortController()
    const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(280_000)])
    const encoder = new TextEncoder()
    const { prompt, code } = body
    const stream = new ReadableStream({
      start(output) {
        const emit = (event: AgentEvent) => { if (!controller.signal.aborted) output.enqueue(encoder.encode(JSON.stringify(event) + "\n")) }
        void runAgent({ prompt, code, error: typeof body.error === "string" ? body.error : "", apiKey }, emit, signal)
          .catch(error => { if (!controller.signal.aborted) emit({ type: "error", message: signal.aborted ? "The request timed out. Your work is preserved; try a smaller change." : error instanceof Error ? error.message : "Generation failed. Please retry." }) })
          .finally(() => { if (!controller.signal.aborted) output.close() })
      },
      cancel() { controller.abort() },
    })
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } })
  } catch (error) { return errorResponse(error) }
}
