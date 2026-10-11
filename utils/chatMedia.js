import path from "path";

export const MAX_CHAT_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_CHAT_VIDEO_BYTES = 50 * 1024 * 1024;

const AUDIO_MIME_BY_EXT = {
  ".mp3": ["audio/mpeg", "audio/mp3"],
  ".m4a": ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"],
  ".aac": ["audio/aac", "audio/x-aac"],
  ".wav": ["audio/wav", "audio/wave", "audio/x-wav"],
  ".ogg": ["audio/ogg", "application/ogg"],
  ".webm": ["audio/webm"]
};

const VIDEO_MIME_BY_EXT = {
  ".mp4": ["video/mp4"],
  ".mov": ["video/quicktime"],
  ".webm": ["video/webm"],
  ".3gp": ["video/3gpp", "video/3gp"]
};

const mimeAllowed = (table, extension, mimeType) =>
  (table[extension] || []).includes(mimeType);

/**
 * Classifies a chat upload. Returns "image" | "pdf" | "audio" | "video", or null.
 * `.mp4` with an audio MIME is treated as a voice note (common recorder output).
 */
export const chatAttachmentKind = (mimeType, originalName) => {
  const extension = path.extname(originalName || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" && extension === ".pdf") return "pdf";
  if (mimeAllowed(AUDIO_MIME_BY_EXT, extension, mime)) return "audio";
  if (extension === ".mp4" && (mime === "audio/mp4" || mime === "audio/x-m4a")) return "audio";
  if (mimeAllowed(VIDEO_MIME_BY_EXT, extension, mime)) return "video";
  return null;
};

export const isVoiceOrVideo = (type) => type === "audio" || type === "video";

export const attachmentPreview = (type) => {
  if (type === "image") return "📷 Photo";
  if (type === "audio") return "🎤 Voice message";
  if (type === "video") return "🎥 Video";
  return "📎 Attachment";
};
