"use client";

import { useRef, useState } from "react";
import {
  ASPECT_RATIOS,
  type AspectRatioId,
} from "@/lib/formats";
import {
  MAX_BROWSER_BYTES,
  processVideoInBrowser,
  type ClientClip,
  type ProgressUpdate,
} from "@/lib/client-ffmpeg";

type UploadZoneProps = {
  disabled?: boolean;
  onProgress: (update: ProgressUpdate & { originalName: string; aspectRatio: AspectRatioId }) => void;
  onComplete: (payload: {
    originalName: string;
    aspectRatio: AspectRatioId;
    clips: ClientClip[];
  }) => void;
  onError: (message: string) => void;
};

export function UploadZone({
  disabled,
  onProgress,
  onComplete,
  onError,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("vertical");

  async function handleFile(file: File | undefined) {
    if (!file || disabled || working) return;
    if (!file.type.startsWith("video/")) {
      onError("Please choose a video file.");
      return;
    }
    if (file.size > MAX_BROWSER_BYTES) {
      onError("Keep files under 200MB for in-browser processing.");
      return;
    }

    setWorking(true);
    onError("");
    try {
      const clips = await processVideoInBrowser(file, aspectRatio, (update) => {
        onProgress({
          ...update,
          originalName: file.name,
          aspectRatio,
        });
      });
      onComplete({
        originalName: file.name,
        aspectRatio,
        clips,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed.";
      onProgress({
        status: "failed",
        progress: 100,
        message: "Something went wrong while repurposing this video.",
        error: message,
        originalName: file.name,
        aspectRatio,
      });
      onError(message);
    } finally {
      setWorking(false);
      setDragging(false);
    }
  }

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[28px] border border-[var(--line)] transition-all duration-300",
        dragging
          ? "bg-[rgba(255,90,31,0.08)] scale-[1.01] shadow-[0_20px_60px_var(--glow)]"
          : "bg-white/55 backdrop-blur-md shadow-[0_18px_50px_rgba(18,22,28,0.08)]",
        disabled || working ? "opacity-70 pointer-events-none" : "",
      ].join(" ")}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        void handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1 progress-sheen opacity-80" />
      <div className="flex w-full flex-col items-start gap-4 px-7 py-8 text-left md:px-10 md:py-10">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
          Process in your browser
        </span>
        <span className="brand-mark max-w-[14ch] text-4xl text-[var(--ink)] md:text-5xl">
          {working ? "Repurping…" : "Upload & repurp"}
        </span>
        <span className="max-w-xl text-base leading-relaxed text-[var(--ink-soft)] md:text-lg">
          MP4, MOV, or WebM up to 200MB. We rip audio locally, transcribe with
          Groq Whisper, then Claude picks complete topics before cutting.
        </span>

        <fieldset className="w-full max-w-xl">
          <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            Output frame
          </legend>
          <div
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="radiogroup"
            aria-label="Output aspect ratio"
          >
            {ASPECT_RATIOS.map((option) => {
              const selected = aspectRatio === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAspectRatio(option.id)}
                  className={[
                    "rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                    selected
                      ? "border-[var(--accent)] bg-white shadow-[0_10px_24px_var(--glow)]"
                      : "border-[var(--line)] bg-white/40 hover:border-[rgba(18,22,28,0.28)]",
                  ].join(" ")}
                >
                  <span className="block text-sm font-semibold text-[var(--ink)]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-[var(--ink-soft)]">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
          onClick={() => inputRef.current?.click()}
        >
          {working ? "Working" : "Choose video"}
          <span aria-hidden className="text-[var(--accent)]">
            →
          </span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
