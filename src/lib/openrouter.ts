import type { Segment } from "@/lib/segments";

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_STT_URL = "https://openrouter.ai/api/v1/audio/transcriptions";

export const CLAUDE_MODEL =
  process.env.OPENROUTER_CLAUDE_MODEL ?? "anthropic/claude-3.5-sonnet";
export const WHISPER_MODEL =
  process.env.OPENROUTER_WHISPER_MODEL ?? "openai/whisper-large-v3";

export type TranscriptCue = {
  start: number;
  end: number;
  text: string;
};

export function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables."
    );
  }
  return key;
}

export function openRouterHeaders(apiKey: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }
  headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME ?? "repurp";
  return headers;
}

export async function transcribeAudioBase64(
  apiKey: string,
  base64: string,
  format: "mp3" | "wav" | "m4a" | "webm" = "mp3"
): Promise<TranscriptCue[]> {
  const res = await fetch(OPENROUTER_STT_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: WHISPER_MODEL,
      input_audio: { data: base64, format },
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    }),
  });

  const raw = (await res.json()) as {
    error?: { message?: string } | string;
    text?: string;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
  };

  if (!res.ok) {
    const msg =
      typeof raw.error === "string"
        ? raw.error
        : raw.error?.message || `Transcription failed (${res.status})`;
    throw new Error(msg);
  }

  if (raw.segments?.length) {
    return raw.segments
      .map((seg) => ({
        start: Number(seg.start ?? 0),
        end: Number(seg.end ?? seg.start ?? 0),
        text: (seg.text ?? "").trim(),
      }))
      .filter((seg) => seg.text.length > 0);
  }

  const text = (raw.text ?? "").trim();
  if (!text) {
    throw new Error("Transcription returned empty text.");
  }
  return [{ start: 0, end: 0, text }];
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude did not return JSON clip boundaries.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function chooseClipsWithClaude(
  apiKey: string,
  duration: number,
  cues: TranscriptCue[]
): Promise<Segment[]> {
  const transcript = cues
    .map(
      (cue) =>
        `[${cue.start.toFixed(1)}-${cue.end.toFixed(1)}] ${cue.text}`
    )
    .join("\n");

  const system = `You are an editor for short-form social video (Reels / Shorts / TikTok).
You receive a timestamped transcript of a longer video.
Pick the best self-contained clips.

Hard rules:
- Never start mid-sentence or mid-thought.
- Never end mid-sentence.
- Each clip must make sense alone: the topic/subject should be clear from the clip itself (include the setup if needed).
- Prefer complete stories, tips, punchlines, or arguments.
- Duration per clip: ideally 15–45 seconds (hard min 8, hard max 55).
- Return at most 8 clips, ranked best-first, then ordered by start time in the JSON array is fine.
- Use only times that align with the transcript cues (snap to nearby cue boundaries).
- If the talk is thin, return fewer clips rather than weak ones.

Respond with JSON only:
{
  "clips": [
    { "start": number, "end": number, "title": string, "reason": string }
  ]
}`;

  const user = `Video duration: ${duration.toFixed(1)} seconds.

Timestamped transcript:
${transcript || "(no speech detected)"}`;

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const raw = (await res.json()) as {
    error?: { message?: string } | string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!res.ok) {
    const msg =
      typeof raw.error === "string"
        ? raw.error
        : raw.error?.message || `Claude request failed (${res.status})`;
    throw new Error(msg);
  }

  const content = raw.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonObject(content) as {
    clips?: Array<{ start?: number; end?: number; title?: string; reason?: string }>;
  };

  const clips = (parsed.clips ?? [])
    .map((clip) => {
      const start = Math.max(0, Number(clip.start ?? 0));
      const end = Math.min(duration, Number(clip.end ?? 0));
      return {
        start,
        end,
        label: (clip.title || clip.reason || "Topic clip").trim(),
      } satisfies Segment;
    })
    .filter((clip) => clip.end - clip.start >= 7.5)
    .sort((a, b) => a.start - b.start)
    .slice(0, 8);

  if (!clips.length) {
    throw new Error("Claude returned no usable clip boundaries.");
  }

  return clips;
}
