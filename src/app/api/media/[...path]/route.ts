import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { CLIPS_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(_req: NextRequest, { params }: Params) {
  const parts = (await params).path;
  if (!parts?.length || parts.some((p) => p.includes("..") || path.isAbsolute(p))) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const filePath = path.join(CLIPS_DIR, ...parts);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(CLIPS_DIR))) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
