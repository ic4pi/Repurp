# repurp

Upload long-form video. Get short-form clips — **entirely in your browser**.

**repurp** uses [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) on the client to detect scene changes, cut contained short clips (roughly 5–45 seconds), and export them as vertical, square, landscape, or original-framed downloads. Nothing is uploaded to a processing server.

## Requirements

- Node.js 20+ (for local development)
- A modern desktop browser with WebAssembly (Chrome/Edge/Firefox/Safari)

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Pick an output frame (vertical 9:16, square 1:1, landscape 16:9, or original).
2. Choose an MP4, MOV, or WebM (up to **200MB** for comfortable browser processing).
3. ffmpeg.wasm loads in the page, detects scenes, and renders clips locally.
4. Preview and download each clip from the gallery (blob URLs in your browser).

## Deploy to Vercel (recommended)

This app is built for your paid Vercel account:

1. Push this repo to GitHub
2. In Vercel → **Add New Project** → import `Repurp`
3. Framework: **Next.js** (defaults are fine — no server env vars required)
4. Deploy

The project sets `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers so the wasm worker can load cleanly.

### Notes

- First run downloads the ffmpeg core (~30MB) into the browser (then cached).
- Large/long videos are slower in-browser than a server encoder; keep samples modest while testing.
- Processing stays on-device — great for privacy and $0 incremental infra cost on Vercel.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run the production server |
| `npm run lint` | ESLint |

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- `@ffmpeg/ffmpeg` + `@ffmpeg/util` for in-browser analysis, cutting, framing, and thumbnails
