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

/**
 * Claude Sonnet 3.5 (OpenRouter) picks self-contained clip boundaries
 * from a timestamped transcript. No media upload on this route.
 */
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
        { error: "No transcript cues available for Claude segmentation." },
        { status: 400 }
      );
    }

    const segments = await chooseClipsWithClaude(apiKey, duration, cues);

    return NextResponse.json({
      engine: "openrouter-claude-3.5-sonnet",
      segments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyze failed.";
    const status = message.includes("OPENROUTER_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
