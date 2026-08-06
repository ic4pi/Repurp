"use client";

import {
  aspectLabel,
  buildVideoFilter,
  type AspectRatioId,
} from "@/lib/formats";
import { buildSegments, formatTime } from "@/lib/segments";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

export const MAX_BROWSER_BYTES = 200 * 1024 * 1024;

export type ClientClip = {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  filename: string;
  label: string;
  url: string;
  thumbnailUrl: string;
};

export type ProgressUpdate = {
  status: "loading" | "analyzing" | "cutting" | "complete" | "failed";
  progress: number;
  message: string;
  clips?: ClientClip[];
  error?: string;
};

type Probe = {
  duration: number;
  width: number;
  height: number;
};

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(
  onLog?: (message: string) => void
): Promise<FFmpeg> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");

  if (ffmpegSingleton?.loaded) {
    if (onLog) {
      ffmpegSingleton.on("log", ({ message }) => onLog(message));
    }
    return ffmpegSingleton;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      // Pin a known-good core build for Next/Vercel.
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
      ffmpegSingleton = ffmpeg;
      return ffmpeg;
    })();
  }

  const ffmpeg = await loadPromise;
  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }
  return ffmpeg;
}

function probeWithElement(file: File): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      if (!duration || !width || !height || !Number.isFinite(duration)) {
        reject(new Error("Could not read video metadata in the browser."));
        return;
      }
      resolve({ duration, width, height });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Browser could not decode this video for metadata."));
    };

    video.src = url;
  });
}

function parseSceneCuts(logs: string[]): number[] {
  const cuts: number[] = [0];
  const re = /pts_time:([0-9.]+)/g;
  for (const line of logs) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const t = Number(match[1]);
      if (Number.isFinite(t)) cuts.push(t);
    }
  }
  return Array.from(new Set(cuts)).sort((a, b) => a - b);
}

async function safeDelete(ffmpeg: FFmpeg, path: string) {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // ignore missing files
  }
}

function extensionFor(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) return ".mov";
  if (name.endsWith(".webm")) return ".webm";
  if (name.endsWith(".mkv")) return ".mkv";
  return ".mp4";
}

function toU8(data: Uint8Array | string): Uint8Array {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return data;
}

export async function processVideoInBrowser(
  file: File,
  aspectRatio: AspectRatioId,
  onProgress: (update: ProgressUpdate) => void
): Promise<ClientClip[]> {
  if (file.size > MAX_BROWSER_BYTES) {
    throw new Error("For browser processing, keep uploads under 200MB.");
  }

  const { fetchFile } = await import("@ffmpeg/util");
  const clips: ClientClip[] = [];
  const logBuffer: string[] = [];

  onProgress({
    status: "loading",
    progress: 4,
    message: "Loading ffmpeg.wasm in your browser…",
  });

  const ffmpeg = await getFFmpeg((message) => {
    logBuffer.push(message);
  });

  onProgress({
    status: "analyzing",
    progress: 12,
    message: "Reading video metadata…",
  });

  const probe = await probeWithElement(file);
  const inputName = `input${extensionFor(file)}`;
  await safeDelete(ffmpeg, inputName);
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress({
    status: "analyzing",
    progress: 22,
    message: "Detecting scene changes…",
  });

  logBuffer.length = 0;
  await ffmpeg.exec([
    "-hide_banner",
    "-i",
    inputName,
    "-filter:v",
    "select='gt(scene,0.28)',showinfo",
    "-f",
    "null",
    "-",
  ]);

  const cuts = parseSceneCuts(logBuffer);
  const segments = buildSegments(probe.duration, cuts);

  onProgress({
    status: "cutting",
    progress: 30,
    message: `Cutting ${segments.length} ${aspectLabel(aspectRatio).toLowerCase()} clip${segments.length === 1 ? "" : "s"}…`,
  });

  const vf = buildVideoFilter(aspectRatio, probe.width, probe.height);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const clipId = crypto.randomUUID().slice(0, 8);
    const clipName = `clip-${String(i + 1).padStart(2, "0")}-${clipId}.mp4`;
    const thumbName = `thumb-${String(i + 1).padStart(2, "0")}-${clipId}.jpg`;
    const duration = Math.max(0.5, seg.end - seg.start);

    await safeDelete(ffmpeg, clipName);
    await safeDelete(ffmpeg, thumbName);

    const code = await ffmpeg.exec([
      "-y",
      "-ss",
      seg.start.toFixed(3),
      "-i",
      inputName,
      "-t",
      duration.toFixed(3),
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      clipName,
    ]);

    if (code !== 0) {
      throw new Error(`Failed to export clip ${i + 1}.`);
    }

    await ffmpeg.exec([
      "-y",
      "-i",
      clipName,
      "-ss",
      "00:00:00.400",
      "-vframes",
      "1",
      "-q:v",
      "5",
      thumbName,
    ]);

    const clipBytes = toU8(await ffmpeg.readFile(clipName));
    const thumbBytes = toU8(await ffmpeg.readFile(thumbName));

    const url = URL.createObjectURL(
      new Blob([clipBytes.buffer as ArrayBuffer], { type: "video/mp4" })
    );
    const thumbnailUrl = URL.createObjectURL(
      new Blob([thumbBytes.buffer as ArrayBuffer], { type: "image/jpeg" })
    );

    clips.push({
      id: clipId,
      index: i + 1,
      start: seg.start,
      end: seg.end,
      duration,
      filename: clipName,
      label: `${seg.label} · ${formatTime(seg.start)}–${formatTime(seg.end)}`,
      url,
      thumbnailUrl,
    });

    await safeDelete(ffmpeg, clipName);
    await safeDelete(ffmpeg, thumbName);

    const progress = 30 + Math.round(((i + 1) / segments.length) * 65);
    onProgress({
      status: "cutting",
      progress,
      message: `Rendered clip ${i + 1} of ${segments.length}…`,
      clips: [...clips],
    });
  }

  await safeDelete(ffmpeg, inputName);

  onProgress({
    status: "complete",
    progress: 100,
    message: `Ready — ${clips.length} ${aspectLabel(aspectRatio).toLowerCase()} clip${clips.length === 1 ? "" : "s"} (processed in your browser).`,
    clips,
  });

  return clips;
}

export function revokeClips(clips: Array<{ url: string; thumbnailUrl: string }>) {
  for (const clip of clips) {
    URL.revokeObjectURL(clip.url);
    URL.revokeObjectURL(clip.thumbnailUrl);
  }
}
