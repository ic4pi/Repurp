import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createJob } from "@/lib/jobs";
import { UPLOADS_DIR } from "@/lib/paths";
import { processJob } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/mpeg",
]);

function extensionFor(file: File): string {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName) return fromName;
  if (file.type === "video/quicktime") return ".mov";
  if (file.type === "video/webm") return ".webm";
  if (file.type === "video/x-matroska") return ".mkv";
  return ".mp4";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("video");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a video file under the “video” field." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max upload is 500MB." },
        { status: 413 }
      );
    }

    if (file.type && !ALLOWED.has(file.type) && !file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload an MP4, MOV, or WebM video." },
        { status: 415 }
      );
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const jobId = uuidv4();
    const filename = `${jobId}${extensionFor(file)}`;
    const dest = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buffer);

    const job = await createJob({
      id: jobId,
      originalName: file.name,
      filename,
    });

    // Fire-and-forget processing on the Node server.
    void processJob(jobId, filename);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: job.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
