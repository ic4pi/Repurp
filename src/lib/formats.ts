export const ASPECT_RATIOS = [
  {
    id: "vertical",
    label: "Vertical",
    hint: "9:16 · Reels / Shorts / TikTok",
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
  },
  {
    id: "square",
    label: "Square",
    hint: "1:1 · Feed posts",
    aspect: 1,
    width: 1080,
    height: 1080,
  },
  {
    id: "landscape",
    label: "Landscape",
    hint: "16:9 · YouTube / web",
    aspect: 16 / 9,
    width: 1920,
    height: 1080,
  },
  {
    id: "original",
    label: "Original",
    hint: "Keep source framing",
    aspect: null,
    width: null,
    height: null,
  },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

export function isAspectRatioId(value: unknown): value is AspectRatioId {
  return (
    typeof value === "string" &&
    ASPECT_RATIOS.some((option) => option.id === value)
  );
}

export function aspectLabel(id: AspectRatioId): string {
  return ASPECT_RATIOS.find((option) => option.id === id)?.label ?? id;
}

export function aspectHint(id: AspectRatioId): string {
  return ASPECT_RATIOS.find((option) => option.id === id)?.hint ?? "";
}

export function previewAspectClass(id: AspectRatioId): string {
  switch (id) {
    case "vertical":
      return "aspect-[9/16]";
    case "square":
      return "aspect-square";
    case "landscape":
      return "aspect-video";
    case "original":
    default:
      return "aspect-video";
  }
}

/** Build an ffmpeg -vf chain for the chosen output framing. */
export function buildVideoFilter(
  aspectRatio: AspectRatioId,
  sourceWidth: number,
  sourceHeight: number
): string {
  const sourceAspect = sourceWidth / sourceHeight;

  if (aspectRatio === "original") {
    const longest = Math.max(sourceWidth, sourceHeight);
    const scale =
      longest > 1920
        ? "scale=1920:-2:force_original_aspect_ratio=decrease"
        : `scale=${sourceWidth}:${sourceHeight}`;
    return `${scale},fps=30`;
  }

  const preset = ASPECT_RATIOS.find((option) => option.id === aspectRatio);
  if (!preset || preset.aspect == null || !preset.width || !preset.height) {
    return `scale=${sourceWidth}:${sourceHeight},fps=30`;
  }

  const targetAspect = preset.aspect;
  let crop: string;
  if (sourceAspect > targetAspect) {
    const newWidth = Math.max(2, Math.floor(sourceHeight * targetAspect / 2) * 2);
    const x = Math.max(0, Math.floor((sourceWidth - newWidth) / 2));
    crop = `crop=${newWidth}:${sourceHeight}:${x}:0`;
  } else if (sourceAspect < targetAspect) {
    const newHeight = Math.max(2, Math.floor(sourceWidth / targetAspect / 2) * 2);
    const y = Math.max(0, Math.floor((sourceHeight - newHeight) / 2));
    crop = `crop=${sourceWidth}:${newHeight}:0:${y}`;
  } else {
    crop = `crop=${sourceWidth}:${sourceHeight}:0:0`;
  }

  return `${crop},scale=${preset.width}:${preset.height},fps=30`;
}
