import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR, JOBS_FILE } from "./paths";

export type JobStatus =
  | "queued"
  | "analyzing"
  | "cutting"
  | "complete"
  | "failed";

export type Clip = {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  filename: string;
  thumbnail: string;
  label: string;
};

export type Job = {
  id: string;
  originalName: string;
  filename: string;
  status: JobStatus;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  duration?: number;
  width?: number;
  height?: number;
  clips: Clip[];
  error?: string;
};

type JobStore = Record<string, Job>;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readStore(): Promise<JobStore> {
  await ensureDir(DATA_DIR);
  try {
    const raw = await fs.readFile(JOBS_FILE, "utf8");
    return JSON.parse(raw) as JobStore;
  } catch {
    return {};
  }
}

async function writeStore(store: JobStore): Promise<void> {
  await ensureDir(DATA_DIR);
  await fs.writeFile(JOBS_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function createJob(
  partial: Pick<Job, "id" | "originalName" | "filename">
): Promise<Job> {
  const now = new Date().toISOString();
  const job: Job = {
    ...partial,
    status: "queued",
    progress: 0,
    message: "Upload received. Queued for repurposing.",
    createdAt: now,
    updatedAt: now,
    clips: [],
  };
  const store = await readStore();
  store[job.id] = job;
  await writeStore(store);
  return job;
}

export async function getJob(id: string): Promise<Job | null> {
  const store = await readStore();
  return store[id] ?? null;
}

export async function updateJob(
  id: string,
  patch: Partial<Job>
): Promise<Job | null> {
  const store = await readStore();
  const existing = store[id];
  if (!existing) return null;
  const next: Job = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store[id] = next;
  await writeStore(store);
  return next;
}

export function clipPublicUrl(jobId: string, filename: string): string {
  return `/api/media/${jobId}/${filename}`;
}

export function jobUploadPath(filename: string): string {
  return path.join(process.cwd(), "uploads", filename);
}
