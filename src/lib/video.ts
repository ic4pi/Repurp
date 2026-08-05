import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { CLIPS_DIR, UPLOADS_DIR } from "./paths";
import { Clip, updateJob } from "./jobs";

type Probe = {
  duration: number;
  width: number;
  height: number;
};

type Segment = {
  start: number;
  end: number;
  label: string;
};

const MIN_CLIP = 8;
const TARGET_CLIP = 28;
const MAX_CLIP = 45;
const MAX_CLIPS = 8;

function run(
  cmd: string,
  args: string[],
  onStderr?: (chunk: string) => void
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      onStderr?.(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function probeVideo(filePath: string): Promise<Probe> {
  const { code, stdout, stderr } = await run("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  if (code !== 0) {
    throw new Error(`ffprobe failed: ${stderr.slice(0, 400)}`);
  }
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
    }>;
  };
  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  const duration = Number(data.format?.duration ?? 0);
  if (!videoStream?.width || !videoStream?.height || !duration) {
    throw new Error("Could not read video dimensions or duration.");
  }
  return {
    duration,
    width: videoStream.width,
    height: videoStream.height,
  };
}

async function detectSceneCuts(filePath: string): Promise<number[]> {
  const cuts: number[] = [0];
  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-i",
    filePath,
    "-filter:v",
    "select='gt(scene,0.28)',showinfo",
    "-f",
    "null",
    "-",
  ]);

  const re = /pts_time:([0-9.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stderr)) !== null) {
    const t = Number(match[1]);
    if (Number.isFinite(t)) cuts.push(t);
  }
  return cuts.sort((a, b) => a - b);
}

function buildSegments(duration: number, cuts: number[]): Segment[] {
  const points = Array.from(
    new Set(
      [...cuts, duration]
        .map((n) => Math.max(0, Math.min(duration, n)))
        .filter((n) => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);

  const raw: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end - start < 1.2) continue;
    raw.push({
      start,
      end,
      label: "Scene beat",
    });
  }

  if (raw.length === 0) {
    const chunk = Math.min(TARGET_CLIP, Math.max(MIN_CLIP, duration));
    for (let start = 0; start < duration - 1; start += chunk) {
      const end = Math.min(duration, start + chunk);
      if (end - start >= MIN_CLIP * 0.75) {
        raw.push({ start, end, label: "Timed cut" });
      }
    }
  }

  const merged: Segment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...seg });
      continue;
    }
    const lastDur = last.end - last.start;
    const nextDur = seg.end - seg.start;
    if (lastDur < MIN_CLIP || (lastDur + nextDur <= MAX_CLIP && nextDur < MIN_CLIP)) {
      last.end = seg.end;
      last.label = "Combined beat";
    } else {
      merged.push({ ...seg });
    }
  }

  const scored = merged
    .map((seg) => {
      const dur = seg.end - seg.start;
      const ideal = 1 - Math.abs(dur - TARGET_CLIP) / TARGET_CLIP;
      return { seg, score: ideal };
    })
    .sort((a, b) => b.score - a.score);

  const picked = scored.slice(0, MAX_CLIPS).map((s) => s.seg);
  picked.sort((a, b) => a.start - b.start);

  // If source is short, still emit at least one clip.
  if (picked.length === 0 && duration > 1) {
    return [
      {
        start: 0,
        end: Math.min(duration, TARGET_CLIP),
        label: "Full take",
      },
    ];
  }

  return picked.map((seg, i) => ({
    ...seg,
    end: Math.min(seg.end, seg.start + MAX_CLIP),
    label: seg.label || `Clip ${i + 1}`,
  }));
}

async function exportClip(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number,
  sourceWidth: number,
  sourceHeight: number
): Promise<void> {
  const duration = Math.max(0.5, end - start);
  const targetAspect = 9 / 16;
  const sourceAspect = sourceWidth / sourceHeight;

  // Center-crop to 9:16 for short-form platforms, then scale to 1080x1920.
  let cropFilter: string;
  if (sourceAspect > targetAspect) {
    const newWidth = Math.floor(sourceHeight * targetAspect);
    const x = Math.floor((sourceWidth - newWidth) / 2);
    cropFilter = `crop=${newWidth}:${sourceHeight}:${x}:0,scale=1080:1920`;
  } else {
    const newHeight = Math.floor(sourceWidth / targetAspect);
    const y = Math.floor((sourceHeight - newHeight) / 2);
    cropFilter = `crop=${sourceWidth}:${newHeight}:0:${y},scale=1080:1920`;
  }

  const { code, stderr } = await run("ffmpeg", [
    "-y",
    "-ss",
    start.toFixed(3),
    "-i",
    inputPath,
    "-t",
    duration.toFixed(3),
    "-vf",
    `${cropFilter},fps=30`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  if (code !== 0) {
    throw new Error(`ffmpeg clip export failed: ${stderr.slice(-500)}`);
  }
}

async function exportThumbnail(
  clipPath: string,
  thumbPath: string
): Promise<void> {
  const { code, stderr } = await run("ffmpeg", [
    "-y",
    "-i",
    clipPath,
    "-ss",
    "00:00:00.400",
    "-vframes",
    "1",
    "-q:v",
    "3",
    thumbPath,
  ]);
  if (code !== 0) {
    throw new Error(`thumbnail failed: ${stderr.slice(-300)}`);
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function processJob(jobId: string, filename: string): Promise<void> {
  const inputPath = path.join(UPLOADS_DIR, filename);
  const jobDir = path.join(CLIPS_DIR, jobId);
  await fs.mkdir(jobDir, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  try {
    await updateJob(jobId, {
      status: "analyzing",
      progress: 8,
      message: "Reading video metadata…",
    });

    const probe = await probeVideo(inputPath);
    await updateJob(jobId, {
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      progress: 18,
      message: "Detecting scene changes…",
    });

    const cuts = await detectSceneCuts(inputPath);
    const segments = buildSegments(probe.duration, cuts);

    await updateJob(jobId, {
      status: "cutting",
      progress: 30,
      message: `Cutting ${segments.length} short-form clip${segments.length === 1 ? "" : "s"}…`,
    });

    const clips: Clip[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const clipId = uuidv4().slice(0, 8);
      const clipName = `clip-${String(i + 1).padStart(2, "0")}-${clipId}.mp4`;
      const thumbName = `thumb-${String(i + 1).padStart(2, "0")}-${clipId}.jpg`;
      const clipPath = path.join(jobDir, clipName);
      const thumbPath = path.join(jobDir, thumbName);

      await exportClip(
        inputPath,
        clipPath,
        seg.start,
        seg.end,
        probe.width,
        probe.height
      );
      await exportThumbnail(clipPath, thumbPath);

      clips.push({
        id: clipId,
        index: i + 1,
        start: seg.start,
        end: seg.end,
        duration: seg.end - seg.start,
        filename: clipName,
        thumbnail: thumbName,
        label: `${seg.label} · ${formatTime(seg.start)}–${formatTime(seg.end)}`,
      });

      const progress = 30 + Math.round(((i + 1) / segments.length) * 65);
      await updateJob(jobId, {
        progress,
        clips: [...clips],
        message: `Rendered clip ${i + 1} of ${segments.length}…`,
      });
    }

    await updateJob(jobId, {
      status: "complete",
      progress: 100,
      clips,
      message: `Ready — ${clips.length} short-form clip${clips.length === 1 ? "" : "s"} from your upload.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    await updateJob(jobId, {
      status: "failed",
      progress: 100,
      error: message,
      message: "Something went wrong while repurposing this video.",
    });
  }
}
