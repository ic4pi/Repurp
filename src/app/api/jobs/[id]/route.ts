import { NextRequest, NextResponse } from "next/server";
import { clipPublicUrl, getJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    originalName: job.originalName,
    aspectRatio: job.aspectRatio ?? "vertical",
    status: job.status,
    progress: job.progress,
    message: job.message,
    duration: job.duration,
    width: job.width,
    height: job.height,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    clips: job.clips.map((clip) => ({
      ...clip,
      url: clipPublicUrl(job.id, clip.filename),
      thumbnailUrl: clipPublicUrl(job.id, clip.thumbnail),
    })),
  });
}
