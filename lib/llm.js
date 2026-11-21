// Thin client for any OpenAI-compatible API. Defaults to Groq's free tier.
// Switch providers with env vars only — e.g. for OpenAI:
//   LLM_BASE_URL=https://api.openai.com/v1  LLM_API_KEY=sk-...  CHAT_MODEL=gpt-4o-mini  STT_MODEL=whisper-1

const BASE_URL = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const API_KEY = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
export const CHAT_MODEL = process.env.CHAT_MODEL || "llama-3.3-70b-versatile";
export const STT_MODEL = process.env.STT_MODEL || "whisper-large-v3-turbo";

export class UpstreamError extends Error {
  constructor(status, detail) {
    super(`Upstream ${status}: ${detail}`);
    this.status = status;
  }
}

function requireKey() {
  if (!API_KEY) throw new UpstreamError(500, "Server is missing GROQ_API_KEY (or LLM_API_KEY).");
}

async function fetchWithTimeout(url, opts, ms = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function chatCompletion(messages) {
  requireKey();
  const r = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, messages, temperature: 0.6, max_tokens: 300 }),
  });
  if (!r.ok) throw new UpstreamError(r.status, (await r.text()).slice(0, 300));
  const data = await r.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

export async function transcribe(audioBuffer, mimeType) {
  requireKey();
  const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("wav") ? "wav"
    : "webm";
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType }), `speech.${ext}`);
  form.append("model", STT_MODEL);
  form.append("language", "en");
  form.append("response_format", "json");
  const r = await fetchWithTimeout(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!r.ok) throw new UpstreamError(r.status, (await r.text()).slice(0, 300));
  const data = await r.json();
  return (data.text || "").trim();
}

// Best-effort per-IP limiter. Serverless instances are short-lived, so this only
// blunts bursts from one visitor; Groq's own quota is the hard backstop.
const hits = new Map();
export function rateLimited(req, limit = 20, windowMs = 60_000) {
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}

export function sendError(res, err) {
  const status = err instanceof UpstreamError ? (err.status === 429 ? 429 : 502) : 500;
  console.error("[voicebot]", err.message);
  const message = status === 429
    ? "The bot is getting a lot of questions right now — please try again in a few seconds."
    : "Something went wrong on my side. Please try again.";
  res.status(status).json({ error: message });
}
