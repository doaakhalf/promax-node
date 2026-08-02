import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway injects RAILWAY_VOLUME_MOUNT_PATH when a Volume is attached to the
// service (e.g. "/data"). Falling back to the local "public/images" tree
// keeps local development working without a Volume configured, and keeps
// the files servable via the existing express.static("public") middleware.
const GALLERY_SUBDIR = "gallery";

const baseDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "images")
  : path.join(__dirname, "..", "public", "images");

export const GALLERY_DIR = path.join(baseDir, GALLERY_SUBDIR);

// Whether the gallery directory lives outside the "public" folder (true when
// backed by a Railway Volume). app.js uses this to decide whether it needs
// to mount an extra static route to serve the files.
export const IS_EXTERNAL_VOLUME = Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH);

export function ensureGalleryDir() {
  if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
  }
  return GALLERY_DIR;
}

export function getGalleryFilePath(fileName) {
  return path.join(GALLERY_DIR, fileName);
}

// Public URL clients use to fetch the image. Served by express.static
// either from "public/images/gallery" or from the mounted Volume (see app.js).
export function buildGalleryImageUrl(fileName) {
  return `/images/${GALLERY_SUBDIR}/${fileName}`;
}
