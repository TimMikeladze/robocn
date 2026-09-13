export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) throw new RequestError("Cross-origin requests are not allowed.", 403)
  if (!request.headers.get("content-type")?.includes("application/json")) throw new RequestError("Expected JSON.", 415)
  if (Number(request.headers.get("content-length")) > 100_000) throw new RequestError("Request is too large.", 413)
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError("Missing request body.")
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 100_000) { await reader.cancel(); throw new RequestError("Request is too large.", 413) }
    chunks.push(value)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error()
    return body
  } catch { throw new RequestError("Invalid JSON request.") }
}

export function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof RequestError ? error.message : "The builder could not complete this request. Please try again." }, { status: error instanceof RequestError ? error.status : 500 })
}
