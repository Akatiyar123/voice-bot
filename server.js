// Local dev server (and a deploy target for Render/Railway). On Vercel this file
// is unused — Vercel serves /public and turns /api/*.js into serverless functions.
//   GROQ_API_KEY=gsk_... node server.js   →  http://localhost:3000
import http from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

// Load .env for local runs (Vercel uses its own Environment Variables instead).
try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch { /* no .env file — fine */ }

// Imported after .env is loaded, because they read env vars at load time.
const { default: chat } = await import("./api/chat.js");
const { default: transcribe } = await import("./api/transcribe.js");

if (!process.env.GROQ_API_KEY && !process.env.LLM_API_KEY) {
  console.warn("⚠️  No GROQ_API_KEY found. Put it in a file named .env next to server.js.");
}

const PORT = process.env.PORT || 3000;
const PUBLIC = join(process.cwd(), "public");
const routes = { "/api/chat": chat, "/api/transcribe": transcribe };
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  // Vercel-style helpers so the same handlers run unchanged.
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };

  if (routes[url.pathname]) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 5_000_000) return res.status(413).json({ error: "Too large" });
    }
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: "Bad JSON" }); }
    return routes[url.pathname](req, res);
  }

  const path = normalize(join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname));
  if (!path.startsWith(PUBLIC)) return res.status(403).end();
  try {
    const file = await readFile(path);
    res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream");
    res.end(file);
  } catch {
    res.status(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Voice bot running at http://localhost:${PORT}`));
