import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import CoachIntroVideo from "../Models/CoachIntroVideo.js";
import {
  INTRO_VIDEO_DIR,
  INTRO_VIDEO_PUBLIC_PREFIX,
  INTRO_VIDEO_UPLOAD_DIR,
} from "../utils/coachIntroVideo.js";

const SCALE = "scale=1280:1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2";
const TIMEOUT_MS = 120000;

let chain = Promise.resolve();
const pending = new Set();

const runFfmpeg = (input, output, withAudio) => new Promise((resolve, reject) => {
  const args = [
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    ...(withAudio ? ["-map", "0:a:0?"] : ["-an"]),
    "-vf",
    SCALE,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "2500k",
    "-maxrate",
    "3000k",
    "-bufsize",
    "5000k",
    ...(withAudio ? ["-c:a", "aac", "-b:a", "128k"] : []),
    "-movflags",
    "+faststart",
    output,
  ];
  const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, TIMEOUT_MS);
  child.stderr.on("data", (buf) => {
    stderr = (stderr + buf.toString()).slice(-4000);
  });
  child.on("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.on("close", (code, signal) => {
    clearTimeout(timer);
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg exited ${code ?? signal}: ${stderr}`));
  });
});

const replaceFile = async (output, input) => {
  try {
    await fs.promises.rename(output, input);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await fs.promises.copyFile(output, input);
    await fs.promises.unlink(output);
  }
};

const transcode = async (url) => {
  const name = path.basename(url);
  const input = path.join(INTRO_VIDEO_DIR, name);
  if (!fs.existsSync(input)) return;

  await fs.promises.mkdir(INTRO_VIDEO_UPLOAD_DIR, { recursive: true });
  const output = path.join(INTRO_VIDEO_UPLOAD_DIR, `${crypto.randomBytes(8).toString("hex")}.mp4`);
  try {
    try {
      await runFfmpeg(input, output, true);
    } catch (error) {
      if (error?.code === "ENOENT") throw error;
      await fs.promises.unlink(output).catch(() => {});
      await runFfmpeg(input, output, false);
    }

    const stat = await fs.promises.stat(output);
    if (!stat.size) throw new Error("Intro video transcode produced an empty file");

    const referenced = await CoachIntroVideo.exists({
      $or: [{ "submission.url": url }, { "published.url": url }],
    });
    if (!referenced || !fs.existsSync(input)) {
      await fs.promises.unlink(output).catch(() => {});
      return;
    }

    await replaceFile(output, input);
    await CoachIntroVideo.updateOne(
      { "submission.url": url },
      { $set: { "submission.sizeBytes": stat.size } }
    );
    await CoachIntroVideo.updateOne(
      { "published.url": url },
      { $set: { "published.sizeBytes": stat.size } }
    );
    return;
  } catch (error) {
    await fs.promises.unlink(output).catch(() => {});
    throw error;
  }
};

export const queueIntroVideoTranscode = (url) => {
  if (typeof url !== "string" || !url.startsWith(INTRO_VIDEO_PUBLIC_PREFIX)) return;
  const name = path.basename(url);
  if (!name || name !== path.basename(name) || name.startsWith(".")) return;
  if (pending.has(url)) return;
  pending.add(url);
  chain = chain
    .then(() => transcode(url))
    .catch((error) => {
      console.error("Intro video transcode failed:", error);
    })
    .finally(() => {
      pending.delete(url);
    });
};
