import Anthropic from "@anthropic-ai/sdk";

import type { DropRow } from "@/lib/dropDisplay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a sneaker and streetwear expert helping users find drops from a live feed.
Given the user's request and the list of current drops, recommend the 2-3 best matches.
For each match, explain in one sentence why it fits what they're looking for.
Be conversational and enthusiastic but concise. If nothing matches well, say so honestly.
When recommending a drop, mention its exact product name as it appears in the drops list.`;

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
    if (!apiKey) {
      return new Response("ANTHROPIC_API_KEY is not configured", { status: 503 });
    }

    const body = (await req.json()) as {
      query?: string;
      drops?: DropRow[];
      history?: HistoryMessage[];
    };

    const query = (body.query || "").trim();
    const drops = Array.isArray(body.drops) ? body.drops : [];
    const history = Array.isArray(body.history) ? body.history : [];

    if (!query) {
      return new Response("Missing query", { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const messages: Anthropic.MessageParam[] = [
      ...history
        .slice(-4)
        .filter(
          (m): m is HistoryMessage =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: `User request: ${query}\n\nCurrent drops (JSON):\n${JSON.stringify(drops)}`,
      },
    ];

    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          console.error("Find-drop stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Find-drop API error:", err);
    return new Response("Failed to find drops", { status: 500 });
  }
}
