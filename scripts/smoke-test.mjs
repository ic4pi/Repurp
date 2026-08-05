import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tmp = path.join(root, "data", "smoke");
const input = path.join(tmp, "source.mp4");
const clip = path.join(tmp, "clip.mp4");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${cmd} failed (${code}): ${stderr.slice(-400)}`));
    });
  });
}

await fs.mkdir(tmp, { recursive: true });

// Synthetic 12s video with a mid-point color change (two “scenes”).
await run("ffmpeg", [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "color=c=0x0f8f7b:s=1280x720:d=6",
  "-f",
  "lavfi",
  "-i",
  "color=c=0xff5a1f:s=1280x720:d=6",
  "-filter_complex",
  "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p",
  "-t",
  "12",
  input,
]);

await run("ffmpeg", [
  "-y",
  "-ss",
  "0",
  "-i",
  input,
  "-t",
  "8",
  "-vf",
  "crop=405:720:437:0,scale=1080:1920,fps=30",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-crf",
  "28",
  "-an",
  clip,
]);

const stat = await fs.stat(clip);
if (stat.size < 1000) {
  throw new Error("Smoke clip looks empty.");
}

console.log("smoke-test ok:", {
  inputBytes: (await fs.stat(input)).size,
  clipBytes: stat.size,
});
