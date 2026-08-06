import { NextRequest, NextResponse } from "next/server";
import { requireGroqKey, transcribeAudioWithGroq } from "@/lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Accepts ripped audio only (multipart). Never send the source video here.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireGroqKey();
    const form = await req.formData();
    const audio = form.get("audio");
    const timeOffset = Number(form.get("timeOffset") ?? 0);

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "Audio is required." },
        { status: 400 }
      );
    }

    if (!audio.type.startsWith("audio/") && !audio.name.match(/\.(mp3|wav|m4a|webm|ogg|mpeg)$/i)) {
      return NextResponse.json(
        { error: "Only audio is accepted on this endpoint." },
        { status: 415 }
      );
    }

    if (audio.size > 24 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio chunk too large." },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const cues = await transcribeAudioWithGroq(apiKey, bytes, audio.name || "audio.mp3");

    return NextResponse.json({
      cues: cues.map((cue) => ({
        start: cue.start + timeOffset,
        end: (cue.end || cue.start) + timeOffset,
        text: cue.text,
      })),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Processing failed.";
    const status = /api_key|GROQ/i.test(raw) ? 503 : 500;
    return NextResponse.json(
      { error: "Could not process this video. Try again." },
      { status }
    );
  }
}
