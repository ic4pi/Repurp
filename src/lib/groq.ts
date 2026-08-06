export type TranscriptCue = {
  start: number;
  end: number;
  text: string;
};

export const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_WHISPER_MODEL =
  process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";

export function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables (free at console.groq.com)."
    );
  }
  return key;
}

/**
 * Transcribe ripped audio bytes with Groq Whisper.
 * Never send video here — audio-only (mp3/wav/m4a/webm).
 */
export async function transcribeAudioWithGroq(
  apiKey: string,
  audio: Uint8Array | Buffer,
  filename = "audio.mp3"
): Promise<TranscriptCue[]> {
  const bytes = audio instanceof Buffer ? audio : Buffer.from(audio);
  const form = new FormData();
  // Blob works in Node 20+ undici FormData
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }),
    filename.endsWith(".mp3") ? filename : `${filename}.mp3`
  );
  form.append("model", GROQ_WHISPER_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch(GROQ_STT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
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
        : raw.error?.message || `Groq transcription failed (${res.status})`;
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
    throw new Error("Groq Whisper returned empty text.");
  }
  return [{ start: 0, end: 0, text }];
}
