import { transcribe, rateLimited, sendError } from "../lib/llm.js";

const MAX_BYTES = 3 * 1024 * 1024; // ~3 MB of audio ≈ well over a minute of opus; Vercel caps bodies at 4.5 MB

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests — give it a few seconds." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const mimeType = String(body.mimeType || "audio/webm").split(";")[0];
    const audio = Buffer.from(String(body.audio || ""), "base64");
    if (audio.length < 1000) return res.status(400).json({ error: "I didn't catch any audio — try holding the mic a little longer." });
    if (audio.length > MAX_BYTES) return res.status(413).json({ error: "That recording is too long — please keep questions under a minute." });

    const started = Date.now();
    const text = await transcribe(audio, mimeType);
    console.log(JSON.stringify({ evt: "stt", ms: Date.now() - started, bytes: audio.length, text: text.slice(0, 120) }));

    res.status(200).json({ text });
  } catch (err) {
    sendError(res, err);
  }
}
