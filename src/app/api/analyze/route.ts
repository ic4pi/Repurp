import { NextRequest, NextResponse } from "next/server";
import {
  chooseClipsWithClaude,
  requireOpenRouterKey,
  transcribeAudioBase64,
  type TranscriptCue,
} from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  duration?: number;
  audioBase64?: string;
  audioFormat?: "mp3" | "wav" | "m4a" | "webm";
  /** Absolute offset to add to every transcript timestamp (for chunked audio). */
  timeOffset?: number;
  /** If provided, skip STT and only run Claude. */
  cues?: TranscriptCue[];
  mode?: "full" | "transcribe" | "segment";
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = requireOpenRouterKey();
    const body = (await req.json()) as Body;
    const duration = Number(body.duration ?? 0);
    const mode = body.mode ?? "full";
    const timeOffset = Number(body.timeOffset ?? 0);

    if (!duration || duration < 1) {
      return NextResponse.json(
        { error: "Missing or invalid video duration." },
        { status: 400 }
      );
    }

    let cues: TranscriptCue[] = Array.isArray(body.cues) ? body.cues : [];

    if (mode === "full" || mode === "transcribe") {
      if (!body.audioBase64) {
        return NextResponse.json(
          { error: "audioBase64 is required for transcription." },
          { status: 400 }
        );
      }
      const transcribed = await transcribeAudioBase64(
        apiKey,
        body.audioBase64,
        body.audioFormat ?? "mp3"
      );
      cues = transcribed.map((cue) => ({
        start: cue.start + timeOffset,
        end: (cue.end || cue.start) + timeOffset,
        text: cue.text,
      }));
    }

    if (mode === "transcribe") {
      return NextResponse.json({
        engine: "openrouter-whisper",
        cues,
      });
    }

    if (!cues.length) {
      return NextResponse.json(
        { error: "No transcript cues available for Claude segmentation." },
        { status: 400 }
      );
    }

    const segments = await chooseClipsWithClaude(apiKey, duration, cues);

    return NextResponse.json({
      engine: "openrouter-claude-3.5-sonnet",
      cues,
      segments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyze failed.";
    const status = message.includes("OPENROUTER_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
