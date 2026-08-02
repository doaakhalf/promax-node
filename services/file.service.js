import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project's "public" directory root. DB-stored image paths (e.g.
// "images/users/xxx.webp") are always relative to this folder.
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Reusable file-system helper for cleaning up images/files that are no
// longer referenced by the database (replaced or deleted), so unused
// files don't keep consuming Railway Volume storage. Domain services
// (Gallery, and the profile/certificate/achievement update flows) call
// into this instead of touching fs directly.
class FileService {
  // Resolves a DB-stored relative path (e.g. "images/users/xxx.webp") to
  // an absolute filesystem path under the project's public/ directory.
  // Returns null for empty/absolute-volume paths so callers can safely
  // pass through values that were already resolved elsewhere (e.g.
  // Gallery's Railway Volume paths).
  static resolvePublicPath(relativePath) {
    if (!relativePath) return null;
    return path.join(PUBLIC_DIR, relativePath);
  }

  static async fileExists(filePath) {
    if (!filePath) return false;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Deletes a single file. Safe to call even if the file is already
  // missing (logged, not thrown) so a request never crashes because of
  // stale/missing file references.
  static async deleteFile(filePath) {
    if (!filePath) return;
    try {
      const exists = await FileService.fileExists(filePath);
      if (!exists) {
        console.warn(`[FileService] File not found, skipping delete: ${filePath}`);
        return;
      }
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`[FileService] Failed to delete file "${filePath}":`, err?.message || err);
    }
  }

  static async deleteMultipleFiles(filePaths = []) {
    await Promise.all(
      filePaths.filter(Boolean).map((filePath) => FileService.deleteFile(filePath))
    );
  }
}

export default FileService;
