import sharp from "sharp";

const LONGEST_SIDE_PX = 1080;
const WEBP_QUALITY = 80;

// Resizes the longest side down to 1080px (never upscales), converts to
// WebP at quality 80, and writes the result to disk. Sharp strips EXIF/ICC
// metadata by default unless .withMetadata() is called, so simply omitting
// that call satisfies the "strip unnecessary metadata" requirement while
// also minimizing file size on the Railway Volume.
export async function optimizeImageToWebp(inputBuffer, outputPath) {
  await sharp(inputBuffer)
    .rotate() // auto-orient based on EXIF before metadata is stripped
    .resize({
      width: LONGEST_SIDE_PX,
      height: LONGEST_SIDE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);
}
