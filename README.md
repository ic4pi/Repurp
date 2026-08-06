# repurp

Upload long-form video. Get short-form clips in your browser — with **topic-aware** boundaries from Claude.

## How clip start/end are chosen

1. **Rip audio locally** with ffmpeg.wasm (`-vn` mono 16kHz mp3). The video file never leaves the browser for transcription.
2. Send **audio chunks only** to `/api/transcribe` → **Groq Whisper** (`whisper-large-v3-turbo`, free tier) returns timestamped speech.
3. **Claude Sonnet 3.5** (OpenRouter) picks self-contained clips that:
   - don’t start/end mid-sentence
   - introduce what the speaker is talking about
   - land as complete tips / stories / arguments (≈15–45s)
4. ffmpeg.wasm cuts those ranges locally in your chosen frame.

If API keys are missing, it falls back to visual scene detection (weaker — can cut mid-sentence).

## Requirements

- Node.js 20+ for local dev
- Modern desktop browser (WebAssembly)
- **`GROQ_API_KEY`** — free at [console.groq.com](https://console.groq.com)
- **`OPENROUTER_API_KEY`** — for Claude at [openrouter.ai/keys](https://openrouter.ai/keys)

## Setup

```bash
npm install
cp .env.example .env.local
# set GROQ_API_KEY and OPENROUTER_API_KEY
npm run dev
```

## Deploy to Vercel

1. Import `ic4pi/Repurp` (Next.js defaults)
2. Add env vars:
   - `GROQ_API_KEY`
   - `OPENROUTER_API_KEY`
3. Redeploy

## Downloads

Each clip has a **Download** link (in-browser blob). Nothing is stored on your server.

## Limits

- Soft ~**200MB** source videos for comfortable browser encodes
- Desktop browsers recommended
- Groq free Whisper quotas apply; Claude usage is billed on OpenRouter

## Stack

- Next.js + TypeScript + Tailwind
- `@ffmpeg/ffmpeg` — local audio rip + clip cut/frame
- Groq `whisper-large-v3-turbo` — speech timestamps
- OpenRouter `anthropic/claude-3.5-sonnet` — editorial clip selection
