"use client";

import { useEffect, useState } from "react";
import { ClipGallery, type PublicClip } from "@/components/ClipGallery";
import { JobStatus } from "@/components/JobStatus";
import { UploadZone } from "@/components/UploadZone";
import type { AspectRatioId } from "@/lib/formats";

type JobResponse = {
  id: string;
  originalName: string;
  aspectRatio?: AspectRatioId;
  status: string;
  progress: number;
  message: string;
  error?: string;
  clips: PublicClip[];
};

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const data = (await res.json()) as JobResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not load job.");
        }
        if (cancelled) return;
        setJob(data);
        if (data.status !== "complete" && data.status !== "failed") {
          timer = setTimeout(() => void poll(), 1200);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Polling failed.");
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const busy =
    !!job && job.status !== "complete" && job.status !== "failed";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-20 pt-8 md:px-8 md:pt-12">
      <header className="animate-rise flex items-center justify-between gap-4">
        <p className="brand-mark text-2xl text-[var(--ink)] md:text-3xl">repurp</p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Long → short
        </p>
      </header>

      <section className="relative mt-14 md:mt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-[-18%] hidden h-[420px] w-[320px] rotate-6 overflow-hidden rounded-[36px] bg-[linear-gradient(160deg,#1c2430_0%,#0f8f7b_55%,#ff5a1f_100%)] opacity-90 shadow-[0_40px_100px_rgba(18,22,28,0.28)] md:block"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_45%)]" />
          <div className="absolute bottom-8 left-7 right-7">
            <p className="brand-mark text-5xl text-white">repurp</p>
            <p className="mt-3 text-sm text-white/80">
              Contained clips, vertical-ready.
            </p>
          </div>
        </div>

        <div className="max-w-2xl">
          <h1 className="brand-mark animate-rise text-[clamp(3.4rem,10vw,6.4rem)] text-[var(--ink)]">
            repurp
          </h1>
          <p className="animate-rise-delay mt-5 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)] md:text-xl">
            Upload one video. Get short-form clips cut from the moments already
            inside it.
          </p>
          <div className="animate-rise-delay-2 mt-8">
            <UploadZone
              disabled={busy}
              onUploaded={(id) => {
                setError("");
                setJob(null);
                setJobId(id);
              }}
              onError={setError}
            />
          </div>
          {error ? (
            <p className="mt-4 text-sm font-medium text-[var(--accent-deep)]">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {job ? (
        <div className="mt-12 space-y-8">
          <JobStatus
            status={job.status}
            progress={job.progress}
            message={job.message}
            originalName={job.originalName}
          />
          {job.error ? (
            <p className="text-sm text-[var(--accent-deep)]">{job.error}</p>
          ) : null}
          {job.status === "complete" ? (
            <ClipGallery
              clips={job.clips}
              aspectRatio={job.aspectRatio ?? "vertical"}
            />
          ) : null}
          {job.status === "complete" || job.status === "failed" ? (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline"
              onClick={() => {
                setJobId(null);
                setJob(null);
                setError("");
              }}
            >
              Start another upload
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="mt-auto pt-20">
        <div className="grid gap-8 border-t border-[var(--line)] pt-8 md:grid-cols-3">
          {[
            {
              title: "Detect",
              copy: "Scene changes mark natural boundaries inside your footage.",
            },
            {
              title: "Cut",
              copy: "Repurp merges beats into short clips sized for social (≈8–45s).",
            },
            {
              title: "Frame",
              copy: "Choose vertical, square, landscape, or original framing before you upload.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="brand-mark text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
