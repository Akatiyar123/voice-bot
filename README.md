# Talk to Aman — a voice bot that answers as me

Open the link, tap the mic, ask a question out loud, and the bot answers out loud the way I would.
It needs no installation and no API key, and it works on desktop and mobile browsers.

**Live demo:** `https://voice-bot-aman-katiyar.vercel.app/`

---

## Write-up: how it works & tools used

```
 Browser                         Vercel serverless functions                Groq (free tier)
 ───────                         ───────────────────────────                ────────────────
 tap mic → MediaRecorder ──audio──▶ /api/transcribe ───────────────▶ Whisper large-v3-turbo
   (auto-stops on silence)                                                  │ text
 transcript ◀──────────────────────────────────────────────────────────────┘
   └─────────────question + history──▶ /api/chat  ── persona prompt ──▶ GPT-OSS 120B
 answer text ◀────────────────────────────────────────────────────────────┘
   └─▶ Web Speech API speaks it aloud (in the browser, free)
```

| Piece | Tool | Why |
|---|---|---|
| Speech → text | **Groq Whisper large-v3-turbo** | Free, fast, accurate, and it works in every browser, including Safari and Firefox, which lack the browser speech-recognition API |
| The "brain" | **OpenAI GPT-OSS 120B on Groq** (open-weight, OpenAI-compatible API) | Free tier, very fast inference, and strong instruction-following; reasoning effort is set to *low* so spoken replies stay quick |
| Persona | `lib/persona.js` → system prompt | A profile I wrote in my own words; the model is told to never invent facts beyond it |
| Text → speech | **Browser Web Speech API** | Free, adds no latency, and is built into every modern browser |
| Hosting | **Vercel** (static page + 2 serverless functions) | Free; the API key stays on the server, so visitors never need one |

**Design decisions**
- **Grounded, not improvised.** All facts come from one profile. For questions the profile doesn't cover, the bot answers in my tone without making up companies, numbers or projects.
- **Built for non-technical users.** It's one big button and stops listening automatically when you pause. There are clickable example questions, a type-instead box if mic access is blocked, and a replay button on every answer.
- **Follow-ups work.** The last few turns are sent with each question, so "can you give an example of that?" makes sense.
- **Production basics.** It has input-size limits, per-IP rate limiting, upstream timeouts, structured logs with latency in the Vercel logs, and friendly error messages. Using another provider only takes env vars (`LLM_BASE_URL`, `CHAT_MODEL`, `STT_MODEL`), for example OpenAI.

---

## Deploy it yourself (≈ 5 minutes, all free)

1. **Get a free Groq API key:** sign up at <https://console.groq.com>, open **API Keys**, then **Create API Key**, and copy the key (it starts with `gsk_`).
2. **Put this folder on GitHub** as a new repository. Uploading the files through the website works.
3. **Deploy on Vercel:** go to <https://vercel.com/new>, import the repository and keep the defaults (Framework preset is "Other"; no build command is needed).
   Under **Environment Variables**, add `GROQ_API_KEY` with your key as its value, then click **Deploy**.
4. Open the `*.vercel.app` URL, allow the microphone, and try it. That URL is your submission.

When you change `lib/persona.js` later, push to GitHub and Vercel redeploys automatically.

### Run locally
```bash
GROQ_API_KEY=gsk_... npm start      # → http://localhost:3000   (Node 18+, no npm install needed)
```
`server.js` also works on Render or Railway: use `npm start` as the start command and set the `GROQ_API_KEY` env var.

## Project layout
```
public/index.html     the whole frontend (vanilla JS, no build step)
api/chat.js           question + history → answer in my voice
api/transcribe.js     recorded audio → text
lib/persona.js        ★ who I am — edit this to change the answers
lib/llm.js            OpenAI-compatible client, rate limiter, error handling
server.js             local / non-Vercel server
```
