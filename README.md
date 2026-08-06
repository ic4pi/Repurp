# repurp

Upload long-form video. Get short-form clips in your browser — with **topic-aware** boundaries from Claude.

## How clip start/end are chosen

1. **Speech first (preferred):** browser extracts audio → OpenRouter **Whisper** returns a timestamped transcript → **Claude Sonnet 3.5** picks self-contained clips that:
   - don’t start/end mid-sentence
   - introduce what the speaker is talking about
   - land as complete tips / stories / arguments (≈15–45s)
2. **Visual fallback:** if `OPENROUTER_API_KEY` is missing or the API fails, ffmpeg.wasm scene detection packs visual cuts (this path *can* start mid-sentence — that’s why Claude is preferred).

Cutting/framing still happens locally with ffmpeg.wasm. Only compact audio (and then transcript text) hits your Vercel API.

## Requirements

- Node.js 20+ for local dev
- Modern desktop browser (WebAssembly)
- **OpenRouter API key** (for smart clips)

## Setup

```bash
npm install
cp .env.example .env.local
# put OPENROUTER_API_KEY=... in .env.local
npm run dev
```

## Deploy to Vercel

1. Import `ic4pi/Repurp` in Vercel (Next.js defaults)
2. Project → **Settings → Environment Variables** → add:
   - `OPENROUTER_API_KEY` = your key from [openrouter.ai/keys](https://openrouter.ai/keys)
3. Redeploy
4. Optional: `OPENROUTER_CLAUDE_MODEL`, `OPENROUTER_WHISPER_MODEL`

No server ffmpeg, disk, or database required.

## Downloads

After processing, each clip has a **Download** link (in-browser blob). Files are not stored on your server — refresh before downloading and they’re gone.

## Limits

- Soft ~**200MB** source videos for comfortable browser encodes
- Desktop browsers recommended; mobile is hit-or-miss
- OpenRouter usage is billed on their side (Whisper + Claude tokens)

## Stack

- Next.js + TypeScript + Tailwind
- `@ffmpeg/ffmpeg` (client cut/frame)
- OpenRouter: `openai/whisper-large-v3` + `anthropic/claude-3.5-sonnet`
