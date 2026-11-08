/**
 * Import Free Exercise Pack into MongoDB.
 *
 * Cloudinary layout (Media Library / Home):
 *   Free Exercise Pack / {equipment} / {bodyPart} / video
 *   (asset_folder holds the path; public_id may stay flat)
 *
 * Modes:
 *   --dry-run --skip-upload   list/parse Cloudinary folder structure only
 *   --import --skip-upload    import from existing Cloudinary assets (no re-upload)
 *   --import                  upload from local pack then upsert
 *   --limit=N                 process first N exercises
 *
 * Env:
 *   MONGO_URI, ADMIN_USER_ID
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   CLOUDINARY_PACK_FOLDER    optional (default: "Free Exercise Pack")
 *   FREE_EXERCISE_PACK_PATH   optional local pack for --import upload mode
 */
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import os from "os";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Exercise from "../Models/Exercise.js";
import { translateName } from "./translateExerciseValues.js";

dotenv.config();

const IMPORT_MODE = process.argv.includes("--import");
const SKIP_UPLOAD = process.argv.includes("--skip-upload");
const DRY_RUN = process.argv.includes("--dry-run") || !IMPORT_MODE;
const LIMIT = (() => {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  if (!arg) return null;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
})();

const ADMIN_ID = process.env.ADMIN_USER_ID;
const MONGO_URI = process.env.MONGO_URI;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_PACK_FOLDER =
  process.env.CLOUDINARY_PACK_FOLDER || "Free Exercise Pack";

const DEFAULT_PACK_PATH = path.join(
  os.homedir(),
  "Downloads",
  "Free Exercise Pack"
);
const PACK_ROOT = process.env.FREE_EXERCISE_PACK_PATH || DEFAULT_PACK_PATH;

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

const EQUIPMENT_BY_FOLDER = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  "cable machine": "cable",
  "smith machine": "smith machine",
  "resistance band": "resistance band",
  bodyweight: "body weight",
  "gym machine": "leverage machine",
  "trx suspension": "suspension trainer",
  stretching: "body weight",
};

const BODY_PART_ALIASES = {
  abs: "abs",
  arm: "arm",
  arms: "arm",
  "arm and shoulders": "shoulders",
  bicep: "biceps",
  biceps: "biceps",
  tricep: "triceps",
  triceps: "triceps",
  forearm: "forearms",
  forearms: "forearms",
  back: "back",
  chest: "chest",
  shoulders: "shoulders",
  legs: "legs",
  "lower body": "lower body",
  "upper body": "upper body",
  cardio: "cardio",
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapEquipment(folderName) {
  const key = normalizeKey(folderName);
  return EQUIPMENT_BY_FOLDER[key] || key;
}

function mapBodyPart(folderName) {
  const key = normalizeKey(folderName);
  return BODY_PART_ALIASES[key] || key;
}

function mapExerciseType({ equipmentFolder, bodyPartFolder, nameEn }) {
  const folder = normalizeKey(equipmentFolder);
  const part = normalizeKey(bodyPartFolder);
  const name = String(nameEn || "").toLowerCase();
  const text = `${folder} ${part} ${name}`;

  if (folder === "stretching" || /stretch|mobility|yoga|flexibility/.test(text)) {
    return "Flexibility";
  }

  if (
    part === "cardio" ||
    /run|jog|jump rope|burpee|mountain climber|cycling|bike|swim|cardio|jumping jack|high knee/.test(
      text
    )
  ) {
    return "Cardio";
  }

  return "Strength";
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ""));
}

function buildNameAr(nameEn) {
  const translated = translateName(nameEn);
  if (
    translated &&
    hasArabic(translated) &&
    normalizeKey(translated) !== normalizeKey(nameEn)
  ) {
    return translated;
  }
  return nameEn;
}

function configureCloudinary() {
  if (!CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required in .env"
    );
  }

  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function cloudinaryPosterUrl(publicId) {
  return cloudinary.url(publicId, {
    resource_type: "video",
    format: "jpg",
    transformation: [{ start_offset: "0" }],
    secure: true,
  });
}

function nameEnFromResource(resource) {
  const raw = resource.display_name || String(resource.public_id).split("/").pop();
  return String(raw)
    .replace(/_side_view/gi, " (side view)")
    .replace(/_s_/g, "'s ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * asset_folder example:
 *   Free Exercise Pack/Barbell/Arm
 *   Free Exercise Pack/TRX Suspension/Arms
 */
function parseAssetFolder(assetFolder) {
  const folder = String(assetFolder || "").trim();
  if (!folder) return null;

  const prefix = CLOUDINARY_PACK_FOLDER.replace(/\/+$/, "");
  if (folder !== prefix && !folder.startsWith(`${prefix}/`)) {
    return null;
  }

  const rest = folder === prefix ? "" : folder.slice(prefix.length + 1);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  return {
    equipmentFolder: parts[0],
    bodyPartFolder: parts[1],
    assetFolder: folder,
  };
}

async function listDirectories(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function listVideos(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name).toLowerCase();
      return VIDEO_EXTENSIONS.has(ext);
    })
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function collectLocalVideos(rootPath) {
  const exercises = [];
  const equipmentFolders = await listDirectories(rootPath);

  for (const equipmentFolder of equipmentFolders) {
    const equipmentPath = path.join(rootPath, equipmentFolder);
    const bodyPartFolders = await listDirectories(equipmentPath);

    for (const bodyPartFolder of bodyPartFolders) {
      const bodyPartPath = path.join(equipmentPath, bodyPartFolder);
      const videos = await listVideos(bodyPartPath);

      for (const fileName of videos) {
        const nameEn = path.basename(fileName, path.extname(fileName)).trim();
        if (!nameEn) continue;

        const equipment = mapEquipment(equipmentFolder);
        const targetBodyPart = mapBodyPart(bodyPartFolder);
        const type = mapExerciseType({
          equipmentFolder,
          bodyPartFolder,
          nameEn,
        });
        const relativePath = path.join(equipmentFolder, bodyPartFolder, fileName);
        const uploadPublicId = [
          "freepack",
          slugify(equipmentFolder),
          slugify(bodyPartFolder),
          slugify(nameEn),
        ].join("/");

        exercises.push({
          nameEn,
          nameAr: buildNameAr(nameEn),
          type,
          equipment,
          targetBodyParts: [targetBodyPart],
          source: "freepack",
          localPath: path.join(bodyPartPath, fileName),
          relativePath,
          uploadPublicId,
          image: null,
          videoUrl: null,
          externalId: null,
          cloudinaryPublicId: null,
        });
      }
    }
  }

  return exercises.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function listCloudinaryVideos() {
  configureCloudinary();
  const resources = [];
  let nextCursor;

  do {
    const page = await cloudinary.api.resources({
      resource_type: "video",
      type: "upload",
      max_results: 500,
      next_cursor: nextCursor,
    });
    resources.push(...(page.resources || []));
    nextCursor = page.next_cursor;
  } while (nextCursor);

  return resources.filter((item) => !String(item.public_id).startsWith("samples/"));
}

function collectExercisesFromCloudinary(resources) {
  const exercises = [];
  const skipped = [];

  for (const resource of resources) {
    const parsed = parseAssetFolder(resource.asset_folder);
    if (!parsed) {
      skipped.push({
        public_id: resource.public_id,
        asset_folder: resource.asset_folder || null,
      });
      continue;
    }

    const nameEn = nameEnFromResource(resource);
    const type = mapExerciseType({
      equipmentFolder: parsed.equipmentFolder,
      bodyPartFolder: parsed.bodyPartFolder,
      nameEn,
    });
    const equipment = mapEquipment(parsed.equipmentFolder);
    const targetBodyPart = mapBodyPart(parsed.bodyPartFolder);
    const publicId = resource.public_id;

    exercises.push({
      nameEn,
      nameAr: buildNameAr(nameEn),
      type,
      equipment,
      targetBodyParts: [targetBodyPart],
      source: "freepack",
      relativePath: `${parsed.assetFolder}/${publicId}`,
      cloudinaryPublicId: publicId,
      externalId: `freepack:${publicId}`,
      videoUrl: resource.secure_url,
      image: cloudinaryPosterUrl(publicId),
      assetFolder: parsed.assetFolder,
      equipmentFolder: parsed.equipmentFolder,
      bodyPartFolder: parsed.bodyPartFolder,
    });
  }

  return {
    exercises: exercises.sort((a, b) =>
      String(a.externalId).localeCompare(String(b.externalId))
    ),
    skipped,
  };
}

async function uploadToCloudinary(exercise) {
  const result = await cloudinary.uploader.upload(exercise.localPath, {
    resource_type: "video",
    public_id: exercise.uploadPublicId,
    overwrite: true,
    invalidate: true,
  });

  const publicId = result.public_id || exercise.uploadPublicId;
  return {
    ...exercise,
    cloudinaryPublicId: publicId,
    externalId: `freepack:${publicId}`,
    videoUrl: result.secure_url,
    image: cloudinaryPosterUrl(publicId),
  };
}

function summarize(exercises) {
  const byType = {};
  const byEquipment = {};
  let arabicCount = 0;

  for (const exercise of exercises) {
    byType[exercise.type] = (byType[exercise.type] || 0) + 1;
    byEquipment[exercise.equipment] = (byEquipment[exercise.equipment] || 0) + 1;
    if (hasArabic(exercise.nameAr)) arabicCount += 1;
  }

  return { byType, byEquipment, arabicCount, total: exercises.length };
}

const UPSERT_BATCH_SIZE = 50;

function toUpsertOperation(exercise) {
  if (!exercise.videoUrl || !exercise.image || !exercise.externalId) {
    throw new Error(
      `Missing Cloudinary URLs for ${exercise.relativePath || exercise.nameEn}`
    );
  }

  return {
    updateOne: {
      filter: { externalId: exercise.externalId },
      update: {
        $set: {
          userId: ADMIN_ID,
          nameEn: exercise.nameEn,
          nameAr: exercise.nameAr,
          type: exercise.type,
          equipment: exercise.equipment,
          targetBodyParts: exercise.targetBodyParts,
          image: exercise.image,
          videoUrl: exercise.videoUrl,
          source: "freepack",
          externalId: exercise.externalId,
        },
      },
      upsert: true,
    },
  };
}

async function upsertExercises(exercises) {
  if (!ADMIN_ID) throw new Error("ADMIN_USER_ID is missing in .env");
  if (!mongoose.isValidObjectId(ADMIN_ID)) {
    throw new Error("ADMIN_USER_ID is not a valid ObjectId");
  }
  if (!MONGO_URI) throw new Error("MONGO_URI is missing in .env");

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 120_000,
  });

  let upserted = 0;
  const totalBatches = Math.ceil(exercises.length / UPSERT_BATCH_SIZE) || 0;

  for (let index = 0; index < exercises.length; index += UPSERT_BATCH_SIZE) {
    const batch = exercises.slice(index, index + UPSERT_BATCH_SIZE);
    const operations = batch.map(toUpsertOperation);
    const batchNumber = Math.floor(index / UPSERT_BATCH_SIZE) + 1;

    console.log(
      `Upserting batch ${batchNumber}/${totalBatches} (${batch.length} exercises)...`
    );

    const result = await Exercise.bulkWrite(operations, { ordered: false });
    const batchCount =
      (result.upsertedCount || 0) +
      (result.modifiedCount || 0) +
      (result.matchedCount || 0);
    upserted += batch.length;
    console.log(
      `  done: upserted=${result.upsertedCount || 0}, modified=${result.modifiedCount || 0}, matched=${result.matchedCount || 0} (batch items=${batchCount})`
    );
  }

  await mongoose.disconnect();
  return upserted;
}

async function main() {
  configureCloudinary();

  let exercises = [];

  if (SKIP_UPLOAD) {
    console.log(
      `Reading Cloudinary folder structure under "${CLOUDINARY_PACK_FOLDER}"...`
    );
    const resources = await listCloudinaryVideos();
    const collected = collectExercisesFromCloudinary(resources);
    exercises = collected.exercises;

    console.log(`Cloudinary videos scanned: ${resources.length}`);
    console.log(`Parsed from pack folders: ${exercises.length}`);
    console.log(`Skipped (outside pack folders): ${collected.skipped.length}`);
    if (collected.skipped.length) {
      console.log("Skipped sample:", collected.skipped.slice(0, 5));
    }
  } else {
    const rootStat = await fs.stat(PACK_ROOT).catch(() => null);
    if (!rootStat?.isDirectory()) {
      throw new Error(`Free Exercise Pack folder not found: ${PACK_ROOT}`);
    }

    console.log(`Scanning local pack: ${PACK_ROOT}`);
    exercises = await collectLocalVideos(PACK_ROOT);
  }

  if (LIMIT) {
    exercises = exercises.slice(0, LIMIT);
    console.log(`Limit enabled: processing first ${exercises.length} videos`);
  }

  const stats = summarize(exercises);
  console.log(`Ready: ${stats.total}`);
  console.log("By type:", stats.byType);
  console.log("By equipment:", stats.byEquipment);
  console.log(`Arabic nameAr: ${stats.arabicCount}/${stats.total}`);
  console.log(
    "Sample:",
    exercises.slice(0, 3).map((item) => ({
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      type: item.type,
      equipment: item.equipment,
      targetBodyParts: item.targetBodyParts,
      assetFolder: item.assetFolder,
      externalId: item.externalId,
      videoUrl: item.videoUrl,
      image: item.image,
      relativePath: item.relativePath,
    }))
  );

  if (DRY_RUN) {
    console.log("Dry run only — no DB writes.");
    console.log(
      "Import from Cloudinary folders: node scripts/importFreeExercisePack.js --import --skip-upload"
    );
    return;
  }

  let ready = exercises;

  if (!SKIP_UPLOAD) {
    ready = [];
    for (let index = 0; index < exercises.length; index += 1) {
      const exercise = exercises[index];
      console.log(
        `[${index + 1}/${exercises.length}] Uploading ${exercise.relativePath}...`
      );
      const result = await uploadToCloudinary(exercise);
      ready.push(result);
      console.log(`  videoUrl=${result.videoUrl}`);
    }
  }

  if (!ready.length) {
    throw new Error("No exercises ready to import");
  }

  const upserted = await upsertExercises(ready);
  console.log(`Upserted ${upserted} exercises with source=freepack`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
