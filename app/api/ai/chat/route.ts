import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai"
import { checkAIAccess, logAIUsage } from "@/lib/ai/guard"
import { buildTools } from "@/lib/ai/tools"

export const runtime = "nodejs"
export const maxDuration = 60

const SYSTEM_PROMPT = `You are the AI co-pilot inside "Team Platform", a small-team project management app.

Scope:
- You help the Team Lead only. Be concise and actionable.
- Reply in Arabic if the user wrote Arabic, in English if they wrote English.
- Use the provided tools when the user asks for data-backed answers (week summary, predictions, audit, changelog draft). Do NOT invent numbers — always call the relevant tool first.
- After calling a tool, summarize the result in plain language. Call out risks and suggest next steps.
- Never expose internal IDs or raw JSON to the user. Format lists as short bullets.
- You do not have write access to the database. Instead of promising to "update the DB", tell the Lead which action to click in the app.`

export async function POST(req: Request) {
  const gate = await checkAIAccess()
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.message }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = (await req.json()) as { messages: UIMessage[] }
  const messages = body.messages ?? []

  const tools = buildTools(gate.teamId)

  const result = streamText({
    model: "openai/gpt-5-mini",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(6),
    onFinish: async ({ usage }) => {
      try {
        await logAIUsage({
          teamId: gate.teamId,
          userId: gate.me.id,
          feature: "chat",
          tokensIn: usage?.inputTokens ?? null,
          tokensOut: usage?.outputTokens ?? null,
          costUsd: null,
        })
      } catch {
        // Logging failure must not break the response.
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
