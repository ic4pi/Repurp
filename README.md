# repurp

Upload long-form video. Get short-form clips.

**repurp** detects scene changes in an uploaded video, groups them into contained short clips (roughly 5–45 seconds), and exports them in the frame you choose: vertical, square, landscape, or original.

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

1. Pick an output frame (vertical 9:16, square 1:1, landscape 16:9, or original).
2. Upload an MP4, MOV, or WebM (up to 500MB).
3. The server probes the file and runs ffmpeg scene detection.
4. Moments become short-form segments and are rendered as downloadable clips.
5. Preview and download each clip from the gallery.

Jobs and media are stored locally under `uploads/`, `clips/`, and `data/`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run the production server |
| `npm run lint` | ESLint |
| `npm run process-check` | Smoke-test the ffmpeg clip pipeline |

## Deploying to Vercel

Vercel can host the Next.js UI, but **this app will not work as-is on Vercel serverless** for real video jobs. Processing needs:

1. **ffmpeg / ffprobe** on the machine (not included on Vercel by default)
2. **Persistent disk or object storage** for uploads and clips (Vercel’s filesystem is ephemeral)
3. **Long-running Node work** after upload (fire-and-forget jobs die when the serverless invocation ends)

### Recommended path (full app works)

Host the whole app on a Node VPS/container that has ffmpeg:

- [Railway](https://railway.app/), [Render](https://render.com/), or [Fly.io](https://fly.io/)
- Install ffmpeg in the image/start command
- Run `npm run build && npm start`
- Attach a persistent volume for `uploads/`, `clips/`, and `data/`

### If you still want Vercel for the frontend

1. Import the GitHub repo in [Vercel](https://vercel.com/new)
2. Framework preset: **Next.js** (defaults are fine)
3. Deploy the UI from Vercel
4. Move `/api/upload`, `/api/jobs`, and `/api/media` to a separate Node host with ffmpeg, **or** rebuild processing to use:
   - **Vercel Blob** (or S3) for media storage
   - An external worker (Inngest, Trigger.dev, Modal, Cloud Run, etc.) that runs ffmpeg
   - Job status in a database (Postgres / KV), not `data/jobs.json`

### Quick Vercel checklist (after architecture changes above)

1. Push this repo to GitHub (already done for `ic4pi/Repurp`)
2. Vercel → **Add New Project** → import `Repurp`
3. Set any secrets the worker/storage needs (e.g. `BLOB_READ_WRITE_TOKEN`)
4. On Pro, raise function `maxDuration` for long encodes (Hobby is too short for most videos)
5. Redeploy and test with a short sample clip first

Until storage + ffmpeg + a durable worker are wired, use local `npm run dev` / `npm start` or Railway/Render/Fly for end-to-end uploads.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- ffmpeg for analysis, cutting, framing, and thumbnails
