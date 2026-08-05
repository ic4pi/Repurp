"use client";

import { useState } from "react";

export type PublicClip = {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  filename: string;
  thumbnail: string;
  label: string;
  url: string;
  thumbnailUrl: string;
};

type ClipGalleryProps = {
  clips: PublicClip[];
};

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function ClipGallery({ clips }: ClipGalleryProps) {
  const [activeId, setActiveId] = useState<string | null>(clips[0]?.id ?? null);
  const active = clips.find((c) => c.id === activeId) ?? clips[0];

  if (!clips.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--teal)]">
            Short-form output
          </p>
          <h2 className="brand-mark mt-2 text-3xl md:text-4xl">
            {clips.length} contained clip{clips.length === 1 ? "" : "s"}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-[var(--ink-soft)]">
          Vertical 9:16 cuts, centered from your source. Preview, then download
          for Reels, Shorts, or TikTok.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="relative mx-auto w-full max-w-[340px]">
          <div className="overflow-hidden rounded-[32px] bg-[var(--ink)] shadow-[0_30px_80px_rgba(18,22,28,0.28)]">
            {active ? (
              <video
                key={active.id}
                className="aspect-[9/16] w-full object-cover"
                src={active.url}
                poster={active.thumbnailUrl}
                controls
                playsInline
              />
            ) : null}
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {clips.map((clip, i) => {
            const selected = clip.id === active?.id;
            return (
              <li
                key={clip.id}
                className="clip-enter"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(clip.id)}
                  className={[
                    "flex w-full items-stretch gap-3 rounded-2xl border p-3 text-left transition-all duration-200",
                    selected
                      ? "border-[var(--accent)] bg-white shadow-[0_12px_30px_var(--glow)]"
                      : "border-[var(--line)] bg-white/55 hover:border-[rgba(18,22,28,0.25)]",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={clip.thumbnailUrl}
                    alt=""
                    className="h-24 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                        Clip {clip.index}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
                        {clip.label}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--teal)]">
                      {formatDuration(clip.duration)}
                    </p>
                  </div>
                </button>
                <a
                  href={clip.url}
                  download={clip.filename}
                  className="mt-2 inline-flex text-sm font-semibold text-[var(--accent-deep)] underline-offset-4 hover:underline"
                >
                  Download clip {clip.index}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
