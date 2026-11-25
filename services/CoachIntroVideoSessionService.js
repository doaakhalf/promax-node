import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import Coach from "../Models/Coach.js";
import ApiError from "../utils/ApiError.js";
import {
  INTRO_VIDEO_DIR,
  INTRO_VIDEO_ERRORS,
  INTRO_VIDEO_PUBLIC_PREFIX,
  INTRO_VIDEO_SESSION_TTL_MS,
  INTRO_VIDEO_UPLOAD_DIR,
  MAX_INTRO_VIDEO_BYTES,
  MAX_INTRO_VIDEO_CHUNK_BYTES,
  MAX_INTRO_VIDEO_CHUNKS,
  RECOMMENDED_INTRO_VIDEO_CHUNK_BYTES,
  deleteIntroVideoFile,
  isAllowedIntroVideo,
  storedExtension,
} from "../utils/coachIntroVideo.js";
import CoachIntroVideoService from "./CoachIntroVideoService.js";

const UPLOAD_ID = /^[a-f0-9]{32}$/;
const CHUNK_INDEX = /^(0|[1-9]\d*)$/;

const sessionDir = (uploadId) => path.join(INTRO_VIDEO_UPLOAD_DIR, uploadId);
const chunksDirOf = (uploadId) => path.join(sessionDir(uploadId), "chunks");
const metaPath = (uploadId) => path.join(sessionDir(uploadId), "meta.json");

const isExpired = (meta) => Date.now() - meta.createdAt > INTRO_VIDEO_SESSION_TTL_MS;

const readMeta = async (uploadId) => {
  try {
    const raw = await fs.promises.readFile(metaPath(uploadId), "utf8");
    const meta = JSON.parse(raw);
    if (!meta || meta.uploadId !== uploadId || typeof meta.userId !== "string") return null;
    return meta;
  } catch {
    return null;
  }
};

const removeSession = async (uploadId) => {
  await fs.promises.rm(sessionDir(uploadId), { recursive: true, force: true });
};

const eachSession = async (fn) => {
  let entries = [];
  try {
    entries = await fs.promises.readdir(INTRO_VIDEO_UPLOAD_DIR, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !UPLOAD_ID.test(entry.name)) continue;
    await fn(entry.name);
  }
};

const assertUploadId = (uploadId) => {
  if (typeof uploadId !== "string" || !UPLOAD_ID.test(uploadId)) {
    throw new ApiError(404, INTRO_VIDEO_ERRORS.sessionNotFound);
  }
};

const loadSession = async (userId, uploadId) => {
  assertUploadId(uploadId);
  const meta = await readMeta(uploadId);
  if (!meta || meta.userId !== String(userId)) {
    throw new ApiError(404, INTRO_VIDEO_ERRORS.sessionNotFound);
  }
  if (isExpired(meta)) {
    await removeSession(uploadId);
    throw new ApiError(400, INTRO_VIDEO_ERRORS.sessionExpired);
  }
  return meta;
};

const chunkFile = (uploadId, index) => path.join(chunksDirOf(uploadId), String(index));
const incomingFile = (uploadId, index) => path.join(chunksDirOf(uploadId), `${index}.incoming`);

const listFinalChunks = async (uploadId) => {
  let names = [];
  try {
    names = await fs.promises.readdir(chunksDirOf(uploadId));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return names.filter((name) => CHUNK_INDEX.test(name));
};

const sumChunkBytes = async (uploadId, names) => {
  let total = 0;
  for (const name of names) {
    const stat = await fs.promises.stat(chunkFile(uploadId, name));
    total += stat.size;
  }
  return total;
};

const parseCreateBody = (body) => {
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.trim() : "";
  const totalBytes = Number(body?.totalBytes);
  const totalChunks = Number(body?.totalChunks);
  if (!fileName || fileName.length > 255 || !mimeType || mimeType.length > 100) {
    throw new ApiError(400, INTRO_VIDEO_ERRORS.badUpload);
  }
  if (!isAllowedIntroVideo(mimeType, fileName) || !storedExtension(mimeType, fileName)) {
    throw new ApiError(400, INTRO_VIDEO_ERRORS.badType);
  }
  if (!Number.isInteger(totalBytes) || totalBytes < 1 || totalBytes > MAX_INTRO_VIDEO_BYTES) {
    throw new ApiError(400, totalBytes > MAX_INTRO_VIDEO_BYTES
      ? INTRO_VIDEO_ERRORS.tooLarge
      : INTRO_VIDEO_ERRORS.badUpload);
  }
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_INTRO_VIDEO_CHUNKS) {
    throw new ApiError(400, INTRO_VIDEO_ERRORS.badUpload);
  }
  const minChunks = Math.ceil(totalBytes / MAX_INTRO_VIDEO_CHUNK_BYTES);
  if (totalChunks < minChunks) {
    throw new ApiError(400, INTRO_VIDEO_ERRORS.chunkTooLarge);
  }
  return { fileName, mimeType, totalBytes, totalChunks };
};

const parseIndex = (value, totalChunks) => {
  if (typeof value !== "string" || !CHUNK_INDEX.test(value)) return null;
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= totalChunks) return null;
  return index;
};

const assemble = async (meta) => {
  const ext = storedExtension(meta.mimeType, meta.fileName);
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const dest = path.join(INTRO_VIDEO_DIR, filename);
  await fs.promises.mkdir(INTRO_VIDEO_DIR, { recursive: true });
  const handle = await fs.promises.open(dest, "w");
  try {
    for (let index = 0; index < meta.totalChunks; index += 1) {
      const bytes = await fs.promises.readFile(chunkFile(meta.uploadId, index));
      let offset = 0;
      while (offset < bytes.length) {
        const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset);
        if (!bytesWritten) break;
        offset += bytesWritten;
      }
      if (offset !== bytes.length) {
        throw new Error("Intro video chunk write was incomplete");
      }
    }
  } catch (error) {
    await handle.close();
    await fs.promises.unlink(dest).catch(() => {});
    throw error;
  }
  await handle.close();
  const stat = await fs.promises.stat(dest);
  if (stat.size !== meta.totalBytes) {
    await fs.promises.unlink(dest).catch(() => {});
    throw new ApiError(400, INTRO_VIDEO_ERRORS.sizeMismatch);
  }
  return { filename, path: dest, size: stat.size };
};

class CoachIntroVideoSessionService {
  static async create(userId, body) {
    const fields = parseCreateBody(body);
    const coach = await Coach.findOne({ userId }).select("_id deletedAt");
    if (!coach || coach.deletedAt) {
      throw new ApiError(404, "لم يتم العثور على حساب الكوتش");
    }

    await fs.promises.mkdir(INTRO_VIDEO_UPLOAD_DIR, { recursive: true });
    const ownerId = String(userId);
    await eachSession(async (uploadId) => {
      const meta = await readMeta(uploadId);
      if (!meta || isExpired(meta) || meta.userId === ownerId) {
        await removeSession(uploadId);
      }
    });

    const uploadId = crypto.randomBytes(16).toString("hex");
    const dir = sessionDir(uploadId);
    await fs.promises.mkdir(path.join(dir, "chunks"), { recursive: true });
    const meta = {
      uploadId,
      userId: ownerId,
      fileName: fields.fileName,
      mimeType: fields.mimeType,
      totalBytes: fields.totalBytes,
      totalChunks: fields.totalChunks,
      createdAt: Date.now(),
    };
    await fs.promises.writeFile(metaPath(uploadId), JSON.stringify(meta));

    return {
      uploadId,
      recommendedChunkBytes: RECOMMENDED_INTRO_VIDEO_CHUNK_BYTES,
      maxChunkBytes: MAX_INTRO_VIDEO_CHUNK_BYTES,
      totalChunks: fields.totalChunks,
      totalBytes: fields.totalBytes,
    };
  }

  static async openChunk(userId, uploadId, indexValue) {
    const meta = await loadSession(userId, uploadId);
    const index = parseIndex(indexValue, meta.totalChunks);
    if (index == null) throw new ApiError(400, INTRO_VIDEO_ERRORS.badUpload);
    return {
      uploadId,
      index,
      chunksDir: chunksDirOf(uploadId),
      totalBytes: meta.totalBytes,
      totalChunks: meta.totalChunks,
    };
  }

  static async acceptChunk(session) {
    const incoming = incomingFile(session.uploadId, session.index);
    let incomingStat;
    try {
      incomingStat = await fs.promises.stat(incoming);
    } catch {
      throw new ApiError(400, INTRO_VIDEO_ERRORS.missing);
    }
    if (incomingStat.size < 1) {
      await fs.promises.unlink(incoming).catch(() => {});
      throw new ApiError(400, INTRO_VIDEO_ERRORS.missing);
    }

    const names = await listFinalChunks(session.uploadId);
    let sum = incomingStat.size;
    for (const name of names) {
      if (Number(name) === session.index) continue;
      sum += (await fs.promises.stat(chunkFile(session.uploadId, name))).size;
    }
    if (sum > session.totalBytes) {
      await fs.promises.unlink(incoming).catch(() => {});
      throw new ApiError(400, INTRO_VIDEO_ERRORS.sizeMismatch);
    }

    await fs.promises.rename(incoming, chunkFile(session.uploadId, session.index));
    const stored = await listFinalChunks(session.uploadId);
    return {
      index: session.index,
      received: stored.length,
      totalChunks: session.totalChunks,
      receivedBytes: await sumChunkBytes(session.uploadId, stored),
      totalBytes: session.totalBytes,
    };
  }

  static async complete(userId, uploadId) {
    const meta = await loadSession(userId, uploadId);
    const names = new Set(await listFinalChunks(uploadId));
    const missing = [];
    for (let index = 0; index < meta.totalChunks; index += 1) {
      if (!names.has(String(index))) missing.push(index);
    }
    if (missing.length) {
      const error = new ApiError(400, INTRO_VIDEO_ERRORS.incomplete);
      error.missing = missing;
      throw error;
    }
    const receivedBytes = await sumChunkBytes(uploadId, [...names]);
    if (receivedBytes !== meta.totalBytes) {
      throw new ApiError(400, INTRO_VIDEO_ERRORS.sizeMismatch);
    }

    const file = await assemble(meta);
    await removeSession(uploadId);
    try {
      return await CoachIntroVideoService.submit(userId, file);
    } catch (error) {
      await deleteIntroVideoFile(`${INTRO_VIDEO_PUBLIC_PREFIX}${file.filename}`);
      throw error;
    }
  }
}

export default CoachIntroVideoSessionService;
