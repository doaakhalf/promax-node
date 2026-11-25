import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_INTRO_VIDEO_SECONDS = 60;
export const MAX_INTRO_VIDEO_MB = 150;
export const MAX_INTRO_VIDEO_BYTES = MAX_INTRO_VIDEO_MB * 1024 * 1024;
export const MAX_INTRO_VIDEO_CHUNK_BYTES = 5 * 1024 * 1024;
export const RECOMMENDED_INTRO_VIDEO_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_INTRO_VIDEO_CHUNKS = 160;
export const INTRO_VIDEO_SESSION_TTL_MS = 60 * 60 * 1000;

export const INTRO_VIDEO_DIR = path.join(__dirname, "..", "public", "videos", "coach-intro");
export const INTRO_VIDEO_UPLOAD_DIR = path.join(INTRO_VIDEO_DIR, ".uploads");
export const INTRO_VIDEO_PUBLIC_PREFIX = "/videos/coach-intro/";

const ALLOWED_EXT = new Set([".mp4", ".mov", ".m4v"]);

const MIME_TO_EXT = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/m4v": ".m4v",
};

export const INTRO_VIDEO_ERRORS = {
  tooLarge: `حجم الفيديو أكبر من ${MAX_INTRO_VIDEO_MB} ميجا`,
  badType: "صيغة الفيديو غير مدعومة. استخدم mp4 أو mov أو m4v",
  tooLong: `مدة الفيديو أطول من ${MAX_INTRO_VIDEO_SECONDS} ثانية`,
  unreadable: "تعذر قراءة مدة الفيديو. ارفع ملف mp4 أو mov من الآيفون",
  missing: "ارفع ملف الفيديو",
  badUpload: "بيانات الرفع غير مكتملة",
  chunkTooLarge: "كل جزء لازم يكون 5 ميجا أو أقل",
  sessionNotFound: "جلسة الرفع غير موجودة. ابدأ الرفع من جديد",
  sessionExpired: "انتهت جلسة الرفع. ابدأ من جديد",
  incomplete: "جزء من الفيديو لم يصل",
  sizeMismatch: "حجم الأجزاء لا يطابق حجم الفيديو",
};

const mimeOf = (mimeType) => (mimeType || "").toLowerCase().split(";")[0].trim();

/**
 * Extension stored on disk. iPhone uploads often use `.MOV` and
 * `video/quicktime`, and sometimes omit the extension entirely.
 */
export const storedExtension = (mimeType, originalName) => {
  const ext = path.extname(originalName || "").toLowerCase();
  if (ALLOWED_EXT.has(ext)) return ext;
  return MIME_TO_EXT[mimeOf(mimeType)] || null;
};

export const isAllowedIntroVideo = (mimeType, originalName) => {
  const ext = storedExtension(mimeType, originalName);
  if (!ext) return false;

  const mime = mimeOf(mimeType);
  const namedExt = path.extname(originalName || "").toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    return ALLOWED_EXT.has(namedExt);
  }
  if (MIME_TO_EXT[mime]) return true;
  return mime.startsWith("video/") && ALLOWED_EXT.has(namedExt);
};

export const durationExceedsLimit = (seconds) =>
  seconds > MAX_INTRO_VIDEO_SECONDS + 0.05;

const readAt = (fd, position, length) => {
  const buf = Buffer.alloc(length);
  const n = fs.readSync(fd, buf, 0, length, position);
  if (n < length) return null;
  return buf;
};

/**
 * Direct child atom inside [rangeStart, rangeEnd). Returns the payload
 * range so callers can scan `moov` without loading the whole file.
 * Handles 32-bit sizes, 64-bit extended sizes, and size 0 (until EOF),
 * which covers iPhone MOV files whose `moov` sits after `mdat`.
 */
const findAtom = (fd, rangeStart, rangeEnd, type) => {
  let offset = rangeStart;
  let guard = 0;
  while (offset + 8 <= rangeEnd && guard < 10000) {
    guard += 1;
    const head = readAt(fd, offset, 8);
    if (!head) return null;
    let size = head.readUInt32BE(0);
    const atomType = head.toString("latin1", 4, 8);
    let headerSize = 8;
    if (size === 1) {
      const ext = readAt(fd, offset + 8, 8);
      if (!ext) return null;
      const big = ext.readBigUInt64BE(0);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      size = rangeEnd - offset;
    }
    if (!Number.isFinite(size) || size < headerSize || offset + size > rangeEnd) {
      return null;
    }
    if (atomType === type) {
      return { payloadStart: offset + headerSize, payloadEnd: offset + size };
    }
    offset += size;
  }
  return null;
};

const readMvhdDuration = (fd, mvhd) => {
  const versionBuf = readAt(fd, mvhd.payloadStart, 1);
  if (!versionBuf) return null;
  const version = versionBuf[0];

  if (version === 0) {
    const body = readAt(fd, mvhd.payloadStart + 4, 16);
    if (!body) return null;
    const timescale = body.readUInt32BE(8);
    const duration = body.readUInt32BE(12);
    if (!timescale) return null;
    return duration / timescale;
  }

  if (version === 1) {
    const body = readAt(fd, mvhd.payloadStart + 4, 28);
    if (!body) return null;
    const timescale = body.readUInt32BE(16);
    const duration = body.readBigUInt64BE(20);
    if (!timescale || duration > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(duration) / timescale;
  }

  return null;
};

/** Seconds from an MP4/MOV/M4V container, or null when the header can't be read. */
export const readVideoDurationSeconds = (filePath) => {
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, "r");
  try {
    const moov = findAtom(fd, 0, stat.size, "moov");
    if (!moov) return null;
    const mvhd = findAtom(fd, moov.payloadStart, moov.payloadEnd, "mvhd");
    if (!mvhd) return null;
    const seconds = readMvhdDuration(fd, mvhd);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  } finally {
    fs.closeSync(fd);
  }
};

export const deleteIntroVideoFile = async (url) => {
  if (typeof url !== "string" || !url.startsWith(INTRO_VIDEO_PUBLIC_PREFIX)) return;
  const name = path.basename(url);
  if (!name || name === "." || name === "..") return;
  const full = path.join(INTRO_VIDEO_DIR, name);
  try {
    await fs.promises.unlink(full);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Intro video delete failed:", error);
    }
  }
};
