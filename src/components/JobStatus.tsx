"use client";

type JobStatusProps = {
  status: string;
  progress: number;
  message: string;
  originalName?: string;
};

export function JobStatus({
  status,
  progress,
  message,
  originalName,
}: JobStatusProps) {
  const active = status !== "complete" && status !== "failed";

  return (
    <section className="animate-rise rounded-[28px] border border-[var(--line)] bg-white/60 px-7 py-7 backdrop-blur-md md:px-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">
            {status}
          </p>
          <h2 className="brand-mark mt-2 text-3xl text-[var(--ink)] md:text-4xl">
            {active ? "Repurposing" : status === "complete" ? "Clips ready" : "Failed"}
          </h2>
          {originalName ? (
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{originalName}</p>
          ) : null}
        </div>
        <p className="text-3xl font-semibold tabular-nums text-[var(--accent)]">
          {Math.round(progress)}%
        </p>
      </div>

      <div className="relative mt-6 h-2.5 overflow-hidden rounded-full bg-[rgba(18,22,28,0.08)]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            active ? "progress-sheen" : "bg-[var(--teal)]"
          }`}
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
        {active ? (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)]"
            style={{ animation: "pulse-ring 1.4s ease-out infinite" }}
          />
        ) : null}
      </div>

      <p className="mt-4 text-base text-[var(--ink-soft)]">{message}</p>
    </section>
  );
}
