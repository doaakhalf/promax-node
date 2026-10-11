import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Exercise from "../Models/Exercise.js";

dotenv.config();

const API_URL = "https://oss.exercisedb.dev/api/v1/exercises";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data"
);
const OUTPUT_PATH = path.join(DATA_DIR, "exercisedb-ar-values.json");
const ENGLISH_PATH = path.join(DATA_DIR, "exercisedb-en.json");

const ADMIN_ID = process.env.ADMIN_USER_ID;
const MONGO_URI = process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TARGET_MUSCLES = [
  "chest",
  "lats",
  "delts",
  "biceps",
  "triceps",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
];

// ExerciseDB filter names differ from the names stored in the app.
const API_MUSCLE_NAMES = {
  chest: "pectorals",
  quadriceps: "quads",
};

const STORED_MUSCLE_NAMES = {
  pectorals: "chest",
  quads: "quadriceps",
};

const EXERCISES_PER_MUSCLE = 20;
const BATCH_SIZE = 8;
const TRANSLATE_RETRIES = 3;
const RATE_LIMIT_RETRIES = 8;
const BATCH_DELAY_MS = 4000;
const ARABIC_RE = /[\u0600-\u06FF]/;
const IMPORT_MODE = process.argv.includes("--import");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hasArabic(text) {
  return ARABIC_RE.test(String(text || ""));
}

function toInstructionSteps(instructions) {
  if (!instructions) return [];
  if (Array.isArray(instructions)) {
    return instructions.map((step) => String(step).trim()).filter(Boolean);
  }
  return String(instructions)
    .split(/,\s*(?=Step:\d)/i)
    .map((step) => step.trim())
    .filter(Boolean);
}

function mapExerciseType(exercise) {
  const name = String(exercise.name || "").toLowerCase();
  const equipment = (exercise.equipments || [])
    .map((item) => String(item).toLowerCase())
    .join(" ");
  const bodyParts = (exercise.bodyParts || [])
    .map((item) => String(item).toLowerCase())
    .join(" ");
  const text = `${name} ${equipment} ${bodyParts}`;

  if (/stretch|mobility|yoga|foam roll|flexibility/.test(text)) {
    return "Flexibility";
  }

  if (
    /run|jog|jump rope|burpee|mountain climber|cycling|bike|swim|cardio|jumping jack|high knee/.test(
      text
    )
  ) {
    return "Cardio";
  }

  return "Strength";
}

function exerciseExternalId(exercise) {
  return String(exercise.exerciseId ?? exercise.id);
}

function toStoredMuscleName(name) {
  const value = String(name);
  return STORED_MUSCLE_NAMES[value] || value;
}

function buildDocument(exercise, nameAr, descriptionAr) {
  const instructionSteps = toInstructionSteps(exercise.instructions);
  const targetBodyParts = [
    ...new Set(
      [...(exercise.bodyParts || []), ...(exercise.targetMuscles || [])].map(
        toStoredMuscleName
      )
    ),
  ];

  return {
    externalId: exerciseExternalId(exercise),
    nameEn: exercise.name,
    nameAr,
    type: mapExerciseType(exercise),
    targetBodyParts,
    descriptionEn: instructionSteps.join("\n") || null,
    descriptionAr: descriptionAr || null,
    image: exercise.gifUrl,
    videoUrl: null,
    source: "exercisedb",
  };
}

async function readOutputFile() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${OUTPUT_PATH} must contain a JSON array`);
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeOutputFile(documents) {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const sorted = [...documents].sort((a, b) =>
    String(a.externalId).localeCompare(String(b.externalId))
  );
  const tempPath = `${OUTPUT_PATH}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(sorted, null, 2)}\n`);
  await fs.rename(tempPath, OUTPUT_PATH);
}

async function getExercisesByMuscle(muscle) {
  const url = new URL(API_URL);
  url.searchParams.set("targetMuscles", muscle);
  url.searchParams.set("limit", String(EXERCISES_PER_MUSCLE));

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`ExerciseDB failed for ${muscle} (${response.status})`);
  }

  const payload = await response.json();
  if (!payload.success) {
    throw new Error(`ExerciseDB failed for muscle: ${muscle}`);
  }

  return payload.data || [];
}

async function fetchSelectedExercises() {
  const selected = new Map();

  for (const muscle of TARGET_MUSCLES) {
    const queryMuscle = API_MUSCLE_NAMES[muscle] || muscle;
    console.log(
      `Fetching ${EXERCISES_PER_MUSCLE} exercises for: ${muscle} (${queryMuscle})`
    );
    const exercises = await getExercisesByMuscle(queryMuscle);
    console.log(`Found ${exercises.length} exercises`);

    for (const exercise of exercises) {
      selected.set(exerciseExternalId(exercise), exercise);
    }

    await sleep(1000);
  }

  return Array.from(selected.values());
}

function extractTranslationRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) return value;
    }
  }
  return null;
}

function acceptTranslations(batch, rows) {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const accepted = [];
  const rejected = [];

  for (const item of batch) {
    const row = byId.get(item.externalId);
    const nameAr = String(row?.nameAr || "").trim();
    const stepsAr = Array.isArray(row?.stepsAr)
      ? row.stepsAr.map((step) => String(step).trim())
      : null;
    const stepsMatch = stepsAr && stepsAr.length === item.steps.length;
    const stepsAreArabic =
      stepsMatch && stepsAr.every((step) => !step || hasArabic(step));

    if (!hasArabic(nameAr) || !stepsAreArabic) {
      rejected.push(item.externalId);
      continue;
    }

    accepted.push(
      buildDocument(item.exercise, nameAr, stepsAr.join("\n") || null)
    );
  }

  return { accepted, rejected };
}

function retryDelayMs(error) {
  const match = String(error?.message || "").match(/retry in ([\d.]+)s/i);
  if (match) return Math.ceil(Number(match[1]) * 1000) + 1000;
  if (error?.status === 429 || error?.status === 503) return 60000;
  return null;
}

async function requestTranslation(batch) {
  const prompt = `You translate gym exercises from English to Arabic.
Use common gym Arabic, not awkward literal wording. Examples: bench press = ضغط البنش, squat = سكوات, deadlift = ديدليفت,
Return a JSON array only. Each item must be {"id","nameAr","stepsAr"}.
stepsAr must keep the same order and the same number of steps as the input.
Translate every step into Arabic.

${JSON.stringify(
  batch.map((item) => ({
    id: item.externalId,
    name: item.exercise.name,
    steps: item.steps,
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
        temperature: 0.2,
      },
    }),
    signal: AbortSignal.timeout(60000),
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
  const rows = extractTranslationRows(JSON.parse(text));
  if (!rows) {
    throw new Error("Gemini JSON was not an array");
  }

  return acceptTranslations(batch, rows);
}

async function translateBatch(batch) {
  let waitMs = 2000;
  let rateLimitWaits = 0;

  for (let attempt = 1; attempt <= TRANSLATE_RETRIES; attempt++) {
    try {
      const result = await requestTranslation(batch);
      if (result.accepted.length > 0 || result.rejected.length === 0) {
        return result;
      }
      throw new Error(
        `No Arabic translations accepted for: ${result.rejected.join(", ")}`
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

async function buildTranslationFile() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in .env");
  }

  const existing = await readOutputFile();
  const cache = new Map(
    existing
      .filter((item) => item?.externalId && hasArabic(item.nameAr))
      .map((item) => [String(item.externalId), item])
  );

  const exercises = await fetchSelectedExercises();
  console.log(`\nTotal unique exercises: ${exercises.length}\n`);

  const pending = [];

  for (const exercise of exercises) {
    const externalId = exerciseExternalId(exercise);
    const cached = cache.get(externalId);

    if (cached && hasArabic(cached.nameAr)) {
      const fresh = buildDocument(exercise, cached.nameAr, cached.descriptionAr);
      cache.set(externalId, fresh);
      console.log(`Cached: ${exercise.name}`);
      continue;
    }

    pending.push({
      externalId,
      exercise,
      steps: toInstructionSteps(exercise.instructions),
    });
  }

  if (cache.size > 0) {
    await writeOutputFile(Array.from(cache.values()));
  }

  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    console.log(
      `\nTranslating ${offset + 1}-${offset + batch.length} of ${pending.length}`
    );

    const { accepted, rejected } = await translateBatch(batch);
    for (const document of accepted) {
      cache.set(document.externalId, document);
      console.log(`Translated: ${document.nameEn}`);
    }
    if (rejected.length > 0) {
      console.warn(`Skipped (no Arabic translation): ${rejected.join(", ")}`);
    }
    if (accepted.length > 0) {
      await writeOutputFile(Array.from(cache.values()));
    }

    if (offset + BATCH_SIZE < pending.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nWrote ${cache.size} exercises to ${OUTPUT_PATH}`);
  if (pending.length > 0) {
    const stillMissing = pending.filter((item) => !cache.has(item.externalId));
    if (stillMissing.length > 0) {
      console.log(
        `${stillMissing.length} exercises were not translated and were left out of the file.`
      );
    }
  }
}

async function readJsonArray(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON array`);
  }
  return parsed;
}

function joinSteps(instructions) {
  const steps = toInstructionSteps(instructions);
  return steps.length > 0 ? steps.join("\n") : null;
}

async function importFromFile() {
  if (!MONGO_URI) throw new Error("MONGO_URI is missing in .env");
  if (!ADMIN_ID) throw new Error("ADMIN_USER_ID is missing in .env");
  if (!mongoose.Types.ObjectId.isValid(ADMIN_ID)) {
    throw new Error("ADMIN_USER_ID is not a valid ObjectId");
  }

  const arabicExercises = await readOutputFile();
  if (arabicExercises.length === 0) {
    throw new Error(`${OUTPUT_PATH} is missing or empty`);
  }

  const englishById = new Map(
    (await readJsonArray(ENGLISH_PATH)).map((exercise) => [
      String(exercise.externalId),
      exercise,
    ])
  );

  const ready = [];
  const skipped = [];

  for (const exercise of arabicExercises) {
    const externalId = String(exercise?.externalId || "");
    const nameAr = String(exercise?.name || "").trim();
    if (!externalId || !hasArabic(nameAr)) {
      skipped.push(externalId || "unknown");
      continue;
    }

    const english = englishById.get(externalId);
    if (!english) {
      skipped.push(externalId);
      continue;
    }

    ready.push({
      externalId,
      nameAr,
      descriptionAr: joinSteps(exercise.instructions),
      nameEn: english.name,
      type: english.type,
      targetBodyParts: english.targetBodyParts,
      descriptionEn: joinSteps(english.instructions),
      image: english.image,
    });
  }

  if (ready.length === 0) {
    throw new Error("No Arabic exercises to import");
  }

  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected\n");

  const result = await Exercise.bulkWrite(
    ready.map((exercise) => ({
      updateOne: {
        filter: { externalId: exercise.externalId },
        update: {
          $set: {
            nameAr: exercise.nameAr,
            descriptionAr: exercise.descriptionAr,
          },
          $setOnInsert: {
            externalId: exercise.externalId,
            userId: ADMIN_ID,
            nameEn: exercise.nameEn,
            type: exercise.type,
            targetBodyParts: exercise.targetBodyParts,
            descriptionEn: exercise.descriptionEn,
            image: exercise.image,
            videoUrl: null,
            source: "exercisedb",
          },
        },
        upsert: true,
      },
    }))
  );

  console.log(`Matched existing exercises: ${result.matchedCount}`);
  console.log(`Updated exercises: ${result.modifiedCount}`);
  console.log(`Inserted exercises: ${result.upsertedCount}`);
  if (skipped.length > 0) {
    console.log(`Skipped rows: ${skipped.join(", ")}`);
  }

  await mongoose.disconnect();
  console.log("\nMongoDB disconnected");
}

async function main() {
  try {
    if (IMPORT_MODE) {
      await importFromFile();
      return;
    }

    await buildTranslationFile();
  } catch (error) {
    console.error("\nFailed:", error.message);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect errors
    }
    process.exit(1);
  }
}

main();
