import { buildSystemPrompt } from "../lib/persona.js";
import { chatCompletion, rateLimited, sendError, CHAT_MODEL } from "../lib/llm.js";

const MAX_TURNS = 8;        // previous messages kept for follow-up questions
const MAX_CHARS = 1000;     // per message

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (rateLimited(req)) return res.status(429).json({ error: "Too many questions at once — give it a few seconds." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const question = String(body.message || "").trim().slice(0, MAX_CHARS);
    if (!question) return res.status(400).json({ error: "Empty question." });

    const history = (Array.isArray(body.history) ? body.history : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

    const started = Date.now();
    const reply = await chatCompletion([
      { role: "system", content: buildSystemPrompt() },
      ...history,
      { role: "user", content: question },
    ]);
    console.log(JSON.stringify({ evt: "chat", model: CHAT_MODEL, ms: Date.now() - started, q: question.slice(0, 120) }));

    res.status(200).json({ reply: reply || "Sorry, could you ask that again?" });
  } catch (err) {
    sendError(res, err);
  }
}
