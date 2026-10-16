import path from "path";
import sharp from "sharp";
import jsQR from "jsqr";
import { createWorker } from "tesseract.js";
import { detectContactLeak } from "./contactGuard.js";

const SCAN_TIMEOUT_MS = 20000;
const cachePath = path.resolve("node_modules/.cache/tesseract");

let workerPromise = null;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Image scan timed out")), ms);
    })
  ]);

const getWorker = () => {
  if (!workerPromise) {
    workerPromise = createWorker("eng+ara", 1, {
      cachePath,
      errorHandler: (error) => console.error("Tesseract error:", error)
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
};

const readQrFromRaw = async (filePath, width) => {
  let pipeline = sharp(filePath, { failOn: "none" }).rotate().ensureAlpha();
  pipeline = width
    ? pipeline.resize({ width, withoutEnlargement: false })
    : pipeline.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return "";

  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const code = jsQR(pixels, info.width, info.height, { inversionAttempts: "attemptBoth" });
  return code?.data || "";
};

const decodeQr = async (filePath) => {
  for (const width of [null, 900, 450]) {
    const text = await readQrFromRaw(filePath, width);
    if (text) return text;
  }
  return "";
};

const recognizeText = async (filePath) => {
  const worker = await getWorker();
  const png = await sharp(filePath, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const result = await worker.recognize(png);
  return result?.data?.text || "";
};

const scan = async (filePath) => {
  const qrText = await decodeQr(filePath);
  const qrHit = qrText ? detectContactLeak(qrText) : null;
  if (qrHit) return { ...qrHit, excerpt: qrText.slice(0, 500) };

  const ocrText = await withTimeout(recognizeText(filePath), SCAN_TIMEOUT_MS);
  const ocrHit = ocrText ? detectContactLeak(ocrText) : null;
  if (ocrHit) return { ...ocrHit, excerpt: ocrText.slice(0, 500) };
  return null;
};

export const IMAGE_SCAN_FAILED_RESPONSE = {
  status: "error",
  code: "IMAGE_SCAN_FAILED",
  message: "Couldn't check this image. Try again."
};

export const scanChatImage = (filePath) => scan(filePath);
