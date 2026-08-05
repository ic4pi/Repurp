"use client";

import { useRef, useState } from "react";

type UploadZoneProps = {
  disabled?: boolean;
  onUploaded: (jobId: string) => void;
  onError: (message: string) => void;
};

export function UploadZone({ disabled, onUploaded, onError }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || disabled || uploading) return;
    if (!file.type.startsWith("video/")) {
      onError("Please choose a video file.");
      return;
    }

    setUploading(true);
    onError("");
    try {
      const body = new FormData();
      body.append("video", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !data.jobId) {
        throw new Error(data.error || "Upload failed.");
      }
      onUploaded(data.jobId);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
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
        disabled || uploading ? "opacity-70 pointer-events-none" : "",
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
      <button
        type="button"
        className="flex w-full flex-col items-start gap-4 px-7 py-8 text-left md:px-10 md:py-10"
        onClick={() => inputRef.current?.click()}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">
          Drop a long-form video
        </span>
        <span className="brand-mark max-w-[14ch] text-4xl text-[var(--ink)] md:text-5xl">
          {uploading ? "Sending…" : "Upload & repurp"}
        </span>
        <span className="max-w-xl text-base leading-relaxed text-[var(--ink-soft)] md:text-lg">
          MP4, MOV, or WebM up to 500MB. We’ll detect contained moments and cut
          vertical short-form clips automatically.
        </span>
        <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]">
          {uploading ? "Uploading" : "Choose video"}
          <span aria-hidden className="text-[var(--accent)]">
            →
          </span>
        </span>
      </button>
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
