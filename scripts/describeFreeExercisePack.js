/**
 * Backfill descriptionEn / descriptionAr for freepack exercises via Gemini.
 *
 * Env:
 *   MONGO_URI
 *   GEMINI_API_KEY
 *
 * Usage:
 *   node scripts/describeFreeExercisePack.js --dry-run --limit=3
 *   node scripts/describeFreeExercisePack.js --import --limit=3
 *   node scripts/describeFreeExercisePack.js --import
 *   node scripts/describeFreeExercisePack.js --import --force
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Exercise from "../Models/Exercise.js";

dotenv.config();

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const MONGO_URI = process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const BATCH_SIZE = 8;
const TRANSLATE_RETRIES = 3;
const RATE_LIMIT_RETRIES = 8;
const BATCH_DELAY_MS = 4000;
const ARABIC_RE = /[\u0600-\u06FF]/;

const IMPORT_MODE = process.argv.includes("--import");
const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run") || !IMPORT_MODE;
const LIMIT = (() => {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  if (!arg) return null;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
})();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hasArabic(text) {
  return ARABIC_RE.test(String(text || ""));
}

function isBlank(text) {
  return !String(text || "").trim();
}

function retryDelayMs(error) {
  const match = String(error?.message || "").match(/retry in ([\d.]+)s/i);
  if (match) return Math.ceil(Number(match[1]) * 1000) + 1000;
  if (error?.status === 429 || error?.status === 503) return 60000;
  return null;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.exercises)) return payload.exercises;
  return null;
}

function normalizeDescription(value) {
  if (Array.isArray(value)) {
    return value
      .map((step) => String(step || "").trim())
      .filter(Boolean)
      .join("\n");
  }
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function acceptDescriptions(batch, rows) {
  const byId = new Map(
    rows
      .filter((row) => row?.id != null)
      .map((row) => [String(row.id), row])
  );

  const accepted = [];
  const rejected = [];

  for (const exercise of batch) {
    const row = byId.get(String(exercise.externalId));
    const descriptionEn = normalizeDescription(row?.descriptionEn);
    const descriptionAr = normalizeDescription(row?.descriptionAr);

    if (!descriptionEn || !descriptionAr || !hasArabic(descriptionAr)) {
      rejected.push(exercise.externalId);
      continue;
    }

    accepted.push({
      externalId: exercise.externalId,
      nameEn: exercise.nameEn,
      descriptionEn,
      descriptionAr,
    });
  }

  return { accepted, rejected };
}

async function requestDescriptions(batch) {
  const prompt = `You write short gym exercise how-to descriptions.
For each exercise, return clear beginner-friendly instructions.
Use common gym Arabic for descriptionAr (e.g. squat=سكوات, bench press=ضغط البنش, curl=كيرل).
Return a JSON array only. Each item must be:
{"id":"<externalId>","descriptionEn":"...","descriptionAr":"..."}
descriptionEn: 3 to 5 short steps in English, separated by newlines.
descriptionAr: the same steps in Arabic gym wording, separated by newlines.
Do not invent equipment that is not listed.

${JSON.stringify(
  batch.map((item) => ({
    id: item.externalId,
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    type: item.type,
    equipment: item.equipment,
    targetBodyParts: item.targetBodyParts,
  }))
)}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
    signal: AbortSignal.timeout(90000),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`Gemini ${response.status}: ${raw.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }

  const payload = JSON.parse(raw);
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON text: ${text.slice(0, 300)}`);
  }

  const rows = extractRows(parsed);
  if (!rows) {
    throw new Error("Gemini JSON was not an array");
  }

  return acceptDescriptions(batch, rows);
}

async function describeBatch(batch) {
  let waitMs = 2000;
  let rateLimitWaits = 0;

  for (let attempt = 1; attempt <= TRANSLATE_RETRIES; attempt++) {
    try {
      const result = await requestDescriptions(batch);
      if (result.accepted.length > 0 || result.rejected.length === 0) {
        return result;
      }
      throw new Error(
        `No descriptions accepted for: ${result.rejected.join(", ")}`
      );
    } catch (error) {
      const delay = retryDelayMs(error);
      if (delay && rateLimitWaits < RATE_LIMIT_RETRIES) {
        rateLimitWaits += 1;
        attempt -= 1;
        console.warn(
          `Gemini is busy. Waiting ${Math.ceil(delay / 1000)}s before retry ${rateLimitWaits}/${RATE_LIMIT_RETRIES}.`
        );
        await sleep(delay);
        continue;
      }

      console.error(
        `Gemini attempt ${attempt}/${TRANSLATE_RETRIES} failed:`,
        error.message
      );
      if (attempt === TRANSLATE_RETRIES) {
        return {
          accepted: [],
          rejected: batch.map((item) => item.externalId),
        };
      }
      await sleep(waitMs);
      waitMs *= 2;
    }
  }

  return {
    accepted: [],
    rejected: batch.map((item) => item.externalId),
  };
}

async function loadExercises() {
  const filter = { source: "freepack" };
  if (!FORCE) {
    filter.$or = [
      { descriptionEn: null },
      { descriptionEn: "" },
      { descriptionAr: null },
      { descriptionAr: "" },
      { descriptionEn: { $exists: false } },
      { descriptionAr: { $exists: false } },
    ];
  }

  let query = Exercise.find(filter)
    .select(
      "externalId nameEn nameAr type equipment targetBodyParts descriptionEn descriptionAr"
    )
    .sort({ externalId: 1 })
    .lean();

  if (LIMIT) query = query.limit(LIMIT);

  return query;
}

async function saveDescriptions(rows) {
  if (!rows.length) return { modified: 0, matched: 0 };

  const operations = rows.map((item) => ({
    updateOne: {
      filter: { externalId: item.externalId, source: "freepack" },
      update: {
        $set: {
          descriptionEn: item.descriptionEn,
          descriptionAr: item.descriptionAr,
        },
      },
    },
  }));

  const result = await Exercise.bulkWrite(operations, { ordered: false });
  return {
    modified: result.modifiedCount || 0,
    matched: result.matchedCount || 0,
  };
}

async function main() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in .env");
  }
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is missing in .env");
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 120_000,
  });

  const exercises = await loadExercises();
  console.log(
    `Loaded ${exercises.length} freepack exercises${FORCE ? " (force)" : " missing descriptions"}`
  );

  if (!exercises.length) {
    console.log("Nothing to describe.");
    await mongoose.disconnect();
    return;
  }

  let acceptedTotal = 0;
  let rejectedTotal = 0;
  let savedTotal = 0;
  const rejectedAll = [];
  const totalBatches = Math.ceil(exercises.length / BATCH_SIZE);

  if (DRY_RUN) {
    console.log("Dry run mode — will call Gemini but will NOT write to Mongo.");
  }

  for (let index = 0; index < exercises.length; index += BATCH_SIZE) {
    const batch = exercises.slice(index, index + BATCH_SIZE);
    const batchNumber = Math.floor(index / BATCH_SIZE) + 1;
    console.log(
      `\nDescribing batch ${batchNumber}/${totalBatches} (${batch.length})...`
    );

    const result = await describeBatch(batch);
    acceptedTotal += result.accepted.length;
    rejectedTotal += result.rejected.length;
    rejectedAll.push(...result.rejected);

    console.log(
      `  accepted=${result.accepted.length}, rejected=${result.rejected.length}`
    );
    if (result.accepted[0]) {
      console.log("  sample:", {
        externalId: result.accepted[0].externalId,
        nameEn: result.accepted[0].nameEn,
        descriptionEn: result.accepted[0].descriptionEn.slice(0, 180),
        descriptionAr: result.accepted[0].descriptionAr.slice(0, 180),
      });
    }

    // Persist immediately so Ctrl+C does not lose accepted descriptions.
    if (!DRY_RUN && result.accepted.length) {
      const writeResult = await saveDescriptions(result.accepted);
      savedTotal += result.accepted.length;
      console.log(
        `  saved to Mongo: modified=${writeResult.modified}, matched=${writeResult.matched}`
      );
    }

    if (index + BATCH_SIZE < exercises.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `\nTotals: accepted=${acceptedTotal}, rejected=${rejectedTotal}, saved=${DRY_RUN ? 0 : savedTotal}`
  );
  if (rejectedAll.length) {
    console.log("Rejected sample:", rejectedAll.slice(0, 10));
  }

  if (DRY_RUN) {
    console.log("Dry run only — no DB writes. Pass --import to save.");
  } else if (!savedTotal) {
    throw new Error("No accepted descriptions were saved");
  } else {
    console.log(`Updated ${savedTotal} freepack exercises with descriptions`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
