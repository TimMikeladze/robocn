import { agentContext, compileError, compileRobot, MAX_CODE_LENGTH } from "./compiler"

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "result"; code: string; explanation: string; name: string; javascript: string; dependencies: string[]; packages: string[]; shadcnDependencies: string[] }
  | { type: "error"; message: string }

const schema = {
  type: "object", additionalProperties: false, required: ["name", "explanation", "code"],
  properties: {
    name: { type: "string", description: "Short kebab-case component filename without extension" },
    explanation: { type: "string", description: "Brief description of what you built or changed, including limitations" },
    code: { type: "string", description: "Full TSX source with a default-exported component" },
  },
}

export async function runAgent(
  input: { prompt: string; code: string; error: string; apiKey: string },
  emit: (event: AgentEvent) => void,
  signal: AbortSignal,
) {
  const messages = [{ role: "user", content: `CURRENT COMPONENT:\n${input.code}\n\nREQUEST:\n${input.prompt}${input.error ? `\nPREVIEW ERROR:\n${input.error}` : ""}` }]
  const instructions = agentContext()
  for (let attempt = 0; attempt < 3; attempt++) {
    emit({ type: "status", message: attempt ? "Repairing the component using compiler feedback…" : "Designing your robot and writing React…" })
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4", store: false,
        instructions, input: messages, max_output_tokens: 16000,
        text: { format: { type: "json_schema", name: "robot_component", strict: true, schema } },
      }),
    })
    if (!response.ok) {
      if (response.status === 401) throw new Error("The agent key was rejected. Check your connection settings.")
      if (response.status === 429) throw new Error("The model is rate limited or out of credits. Check your API account and try again.")
      throw new Error(`The model request failed (${response.status}). Check model access and try again.`)
    }
    const data = await response.json()
    if (data.status !== "completed") throw new Error("The model did not finish the component. Try a smaller change or retry.")
    const raw = (data.output ?? []).flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? [])
      .filter((item: { type: string }) => item.type === "output_text").map((item: { text: string }) => item.text).join("")
    let result: { name: string; explanation: string; code: string }
    try { result = JSON.parse(raw) } catch { throw new Error("The model did not return component code. Try rephrasing your request.") }
    if (typeof result.code !== "string" || !result.code.trim() || result.code.length > MAX_CODE_LENGTH || typeof result.explanation !== "string" || typeof result.name !== "string") throw new Error("The model returned an invalid component. Please retry.")
    emit({ type: "status", message: "Compiling against the robocn library…" })
    try {
      const compiled = await compileRobot(result.code)
      signal.throwIfAborted()
      emit({ type: "result", ...result, name: result.name.replace(/[^a-z0-9-]/g, "").slice(0, 60) || "my-robot", ...compiled })
      return
    } catch (error) {
      signal.throwIfAborted()
      const detail = compileError(error)
      if (attempt === 2) throw new Error(`The agent couldn't compile this version after three attempts. Your previous work is preserved. ${detail}`)
      messages.push({ role: "assistant", content: raw }, { role: "user", content: `Fix these compiler errors and return the entire component again:\n${detail}` })
    }
  }
}
