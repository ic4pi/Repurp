# repurp

Upload long-form video. Get short-form clips.

**repurp** detects scene changes in an uploaded video, groups them into contained short clips (roughly 8–45 seconds), and exports vertical 9:16 cuts ready for Reels, Shorts, and TikTok.

## Requirements

- Node.js 20+
- [ffmpeg](https://ffmpeg.org/) and `ffprobe` on your `PATH`

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Upload an MP4, MOV, or WebM (up to 500MB).
2. The server probes the file and runs ffmpeg scene detection.
3. Moments are merged into short-form segments and rendered as 1080×1920 clips.
4. Preview and download each clip from the gallery.

Jobs and media are stored locally under `uploads/`, `clips/`, and `data/`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run the production server |
| `npm run lint` | ESLint |
| `npm run process-check` | Smoke-test the ffmpeg clip pipeline |

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- ffmpeg for analysis, cutting, vertical framing, and thumbnails
