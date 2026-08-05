import path from "path";

export const ROOT = process.cwd();
export const UPLOADS_DIR = path.join(/* turbopackIgnore: true */ ROOT, "uploads");
export const CLIPS_DIR = path.join(/* turbopackIgnore: true */ ROOT, "clips");
export const DATA_DIR = path.join(/* turbopackIgnore: true */ ROOT, "data");
export const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
