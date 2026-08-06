import { NextRequest, NextResponse } from "next/server";
import {
  chooseClipsWithClaude,
  requireOpenRouterKey,
  type TranscriptCue,
} from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  duration?: number;
  cues?: TranscriptCue[];
};

/** Picks self-contained clip boundaries from a timestamped transcript. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireOpenRouterKey();
    const body = (await req.json()) as Body;
    const duration = Number(body.duration ?? 0);
    const cues = Array.isArray(body.cues) ? body.cues : [];

    if (!duration || duration < 1) {
      return NextResponse.json(
        { error: "Missing or invalid video duration." },
        { status: 400 }
      );
    }

    if (!cues.length) {
      return NextResponse.json(
        { error: "No speech moments available to select clips." },
        { status: 400 }
      );
    }

    const segments = await chooseClipsWithClaude(apiKey, duration, cues);

    return NextResponse.json({ segments });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Processing failed.";
    const status = /api_key|OPENROUTER/i.test(raw) ? 503 : 500;
    return NextResponse.json(
      { error: "Could not choose clip moments. Try again." },
      { status }
    );
  }
}
