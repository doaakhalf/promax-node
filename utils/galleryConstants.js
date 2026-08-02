// Shared Gallery constants, reused by the dedicated /users/gallery upload
// middleware AND by the signup/edit flows that fold gallery handling into
// their existing multipart requests. Kept in one place to avoid duplicating
// these rules across files.
export const ALLOWED_GALLERY_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_GALLERY_IMAGES = Number(process.env.MAX_GALLERY_IMAGES) || 10;

export const MAX_IMAGE_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB) || 2;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
