import { NextRequest, NextResponse } from "next/server";
import { requireGroqKey, transcribeAudioWithGroq } from "@/lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Accepts ripped audio only (multipart). Never send the source video here.
 * Form fields:
 * - audio: File (mp3 preferred)
 * - timeOffset: number (seconds to add to Whisper timestamps for chunked audio)
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireGroqKey();
    const form = await req.formData();
    const audio = form.get("audio");
    const timeOffset = Number(form.get("timeOffset") ?? 0);

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "Send ripped audio as multipart field “audio” (not the video file)." },
        { status: 400 }
      );
    }

    if (!audio.type.startsWith("audio/") && !audio.name.match(/\.(mp3|wav|m4a|webm|ogg|mpeg)$/i)) {
      return NextResponse.json(
        { error: "Only audio files are accepted. Rip audio from the video first." },
        { status: 415 }
      );
    }

    // Soft guard — Groq allows larger, but we keep chunks small on purpose.
    if (audio.size > 24 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio chunk too large. Use a shorter chunk." },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const cues = await transcribeAudioWithGroq(apiKey, bytes, audio.name || "audio.mp3");

    return NextResponse.json({
      engine: "groq-whisper-large-v3-turbo",
      cues: cues.map((cue) => ({
        start: cue.start + timeOffset,
        end: (cue.end || cue.start) + timeOffset,
        text: cue.text,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed.";
    const status = message.includes("GROQ_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
