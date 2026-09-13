import { compileError, compileRobot } from "@/lib/builder/compiler"
import { errorResponse, readBody, RequestError } from "@/lib/builder/http"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const body = await readBody(request)
    if (typeof body.code !== "string") throw new RequestError("Component source is required.")
    try { return Response.json(await compileRobot(body.code), { headers: { "Cache-Control": "no-store" } }) }
    catch (error) { throw new RequestError(compileError(error), 422) }
  } catch (error) { return errorResponse(error) }
}
