export type Segment = {
  start: number;
  end: number;
  label: string;
};

const MIN_CLIP = 5;
const TARGET_CLIP = 24;
const MAX_CLIP = 45;
const MAX_CLIPS = 8;

export function buildSegments(duration: number, cuts: number[]): Segment[] {
  const points = Array.from(
    new Set(
      [0, ...cuts, duration]
        .map((n) => Math.max(0, Math.min(duration, n)))
        .filter((n) => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);

  const scenes: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end - start >= 1.0) {
      scenes.push({ start, end, label: "Scene beat" });
    }
  }

  const packed: Segment[] = [];
  let buf: Segment | null = null;

  const flush = () => {
    if (!buf) return;
    const dur = buf.end - buf.start;
    if (dur >= MIN_CLIP * 0.75) {
      if (dur > MAX_CLIP) {
        for (let start = buf.start; start < buf.end - 0.5; start += TARGET_CLIP) {
          const end = Math.min(buf.end, start + MAX_CLIP);
          if (end - start >= MIN_CLIP * 0.75) {
            packed.push({
              start,
              end,
              label: "Highlight cut",
            });
          }
        }
      } else {
        packed.push(buf);
      }
    }
    buf = null;
  };

  for (const scene of scenes) {
    const sceneDur = scene.end - scene.start;

    if (sceneDur >= MIN_CLIP && sceneDur <= MAX_CLIP) {
      flush();
      packed.push({ ...scene, label: "Scene beat" });
      continue;
    }

    if (!buf) {
      buf = { ...scene, label: "Scene pack" };
      continue;
    }

    const combined = buf.end - buf.start + sceneDur;
    if (combined <= MAX_CLIP) {
      buf.end = scene.end;
      buf.label = "Scene pack";
    } else {
      flush();
      buf = { ...scene, label: "Scene pack" };
    }
  }
  flush();

  if (packed.length === 0) {
    const chunk = Math.min(TARGET_CLIP, Math.max(MIN_CLIP, duration));
    for (let start = 0; start < duration - 0.5; start += chunk) {
      const end = Math.min(duration, start + chunk);
      if (end - start >= MIN_CLIP * 0.75) {
        packed.push({ start, end, label: "Timed cut" });
      }
    }
  }

  let picked = packed;
  if (packed.length > MAX_CLIPS) {
    const step = packed.length / MAX_CLIPS;
    picked = Array.from({ length: MAX_CLIPS }, (_, i) => {
      return packed[Math.min(packed.length - 1, Math.floor(i * step))];
    });
  }

  if (picked.length === 0 && duration > 1) {
    return [
      {
        start: 0,
        end: Math.min(duration, TARGET_CLIP),
        label: "Full take",
      },
    ];
  }

  return picked.map((seg) => ({
    ...seg,
    end: Math.min(seg.end, seg.start + MAX_CLIP),
  }));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
