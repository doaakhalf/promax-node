import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import Exercise from "../Models/Exercise.js";

dotenv.config();

const API_URL = "https://oss.exercisedb.dev/api/v1/exercises";
const TRANSLATE_URL = "https://api.mymemory.translated.net/get";

const ADMIN_ID = process.env.ADMIN_ID;
const MONGO_URI = process.env.MONGO_URI;

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

const EXERCISES_PER_MUSCLE = 10;
const MYMEMORY_MAX_CHARS = 450;
const TRANSLATE_DELAY_MS = 1200;
const TRANSLATE_RETRIES = 3;
const SKIP_TRANSLATION =
  process.env.SKIP_TRANSLATION === "true" ||
  process.argv.includes("--skip-translation");
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || null;

let translationQuotaExceeded = SKIP_TRANSLATION;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isQuotaExceededPayload(payload) {
  const details =
    typeof payload === "string"
      ? payload
      : payload?.responseDetails ||
        payload?.responseData?.translatedText ||
        JSON.stringify(payload || {});

  return (
    payload?.responseStatus === 429 ||
    String(details).toUpperCase().includes("USED ALL AVAILABLE FREE TRANSLATIONS")
  );
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

function chunkText(text, maxChars = MYMEMORY_MAX_CHARS) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(" ", maxChars);
    if (splitAt < maxChars * 0.5) splitAt = maxChars;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function translateChunk(chunk) {
  if (translationQuotaExceeded) return chunk;

  let waitMs = TRANSLATE_DELAY_MS;

  for (let attempt = 1; attempt <= TRANSLATE_RETRIES; attempt++) {
    try {
      const params = {
        q: chunk,
        langpair: "en|ar",
      };
      if (MYMEMORY_EMAIL) params.de = MYMEMORY_EMAIL;

      const response = await axios.get(TRANSLATE_URL, {
        params,
        timeout: 15000,
      });

      if (isQuotaExceededPayload(response.data)) {
        translationQuotaExceeded = true;
        console.warn(
          "\nMyMemory daily free quota reached. Continuing with English for remaining Arabic fields.\n"
        );
        return chunk;
      }

      const translated = response.data?.responseData?.translatedText;
      if (translated) return translated;

      throw new Error(
        response.data?.responseDetails || "Empty translation response"
      );
    } catch (error) {
      const status = error.response?.status;
      const payload = error.response?.data || error.message;

      if (status === 429 || isQuotaExceededPayload(payload)) {
        translationQuotaExceeded = true;
        console.warn(
          "\nMyMemory daily free quota reached. Continuing with English for remaining Arabic fields.\n"
        );
        return chunk;
      }

      console.error(
        `Translation attempt ${attempt}/${TRANSLATE_RETRIES} failed (${status || "no-status"}):`,
        typeof payload === "string" ? payload : JSON.stringify(payload)
      );

      if (attempt === TRANSLATE_RETRIES) return chunk;
      await sleep(waitMs);
      waitMs *= 2;
    }
  }

  return chunk;
}
function mapExerciseType(exercise) {
    const name = String(exercise.name || "").toLowerCase();
    const equipment = (exercise.equipments || []).map((e) => String(e).toLowerCase()).join(" ");
    const bodyParts = (exercise.bodyParts || []).map((p) => String(p).toLowerCase()).join(" ");
    const text = `${name} ${equipment} ${bodyParts}`;
  
    // Flexibility
    if (
      /stretch|mobility|yoga|foam roll|flexibility/.test(text)
    ) {
      return "Flexibility";
    }
  
    // Cardio
    if (
      /run|jog|jump rope|burpee|mountain climber|cycling|bike|swim|cardio|jumping jack|high knee/.test(text)
    ) {
      return "Cardio";
    }
  
    // default
    return "Strength";
  }
async function translateToArabic(text) {
  if (!text || translationQuotaExceeded) return text;

  const input = String(text).trim();
  if (!input) return input;

  const chunks = chunkText(input);
  const translatedChunks = [];

  for (const chunk of chunks) {
    const translated = await translateChunk(chunk);
    translatedChunks.push(translated);
    if (translationQuotaExceeded) break;
    await sleep(TRANSLATE_DELAY_MS);
  }

  return translatedChunks.join(" ").trim() || input;
}

async function translateStepsToArabic(steps) {
  if (translationQuotaExceeded) return steps;

  const translated = [];
  for (const step of steps) {
    translated.push(await translateToArabic(step));
    if (translationQuotaExceeded) {
      // fill remaining steps with English
      const remaining = steps.slice(translated.length);
      translated.push(...remaining);
      break;
    }
  }
  return translated;
}

async function getExercisesByMuscle(muscle) {
  try {
    const response = await axios.get(API_URL, {
      params: {
        targetMuscles: muscle,
        limit: EXERCISES_PER_MUSCLE,
      },
      timeout: 30000,
    });

    if (!response.data.success) {
      throw new Error(`API failed for muscle: ${muscle}`);
    }

    return response.data.data || [];
  } catch (error) {
    console.error(
      `Failed to fetch ${muscle}:`,
      error.response?.data || error.message
    );
    return [];
  }
}

async function mapExercise(exercise, index, total) {
  const instructionSteps = toInstructionSteps(exercise.instructions);

  if (translationQuotaExceeded) {
    console.log(
      `Saving ${index + 1}/${total}: ${exercise.name} (English only — quota exceeded)`
    );
  } else {
    console.log(
      `Translating ${index + 1}/${total}: ${exercise.name} (${instructionSteps.length} steps)`
    );
  }

  const nameAr = await translateToArabic(exercise.name);
  const instructionStepsAr = await translateStepsToArabic(instructionSteps);

  return {
    userId: ADMIN_ID,
    externalId: String(exercise.exerciseId ?? exercise.id),
    nameEn: exercise.name,
    nameAr: nameAr || exercise.name,
    type: mapExerciseType(exercise),
    targetBodyParts: [
      ...(exercise.bodyParts || []),
      ...(exercise.targetMuscles || []),
    ],
    descriptionEn: instructionSteps.join("\n") || null,
    descriptionAr: instructionStepsAr.join("\n") || null,
    image: exercise.gifUrl,
    videoUrl: null,
    source: "exercisedb",
  };
}

async function importExercises() {
  try {
    if (!MONGO_URI) throw new Error("MONGO_URI is missing in .env");
    if (!ADMIN_ID) throw new Error("ADMIN_ID is missing in .env");

    if (SKIP_TRANSLATION) {
      console.log("SKIP_TRANSLATION enabled — importing English for Arabic fields.\n");
    }

    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected\n");

    const selectedExercises = new Map();

    for (const muscle of TARGET_MUSCLES) {
      console.log(`Fetching ${EXERCISES_PER_MUSCLE} exercises for: ${muscle}`);

      const exercises = await getExercisesByMuscle(muscle);
      console.log(`Found ${exercises.length} exercises`);

      for (const exercise of exercises) {
        selectedExercises.set(exercise.exerciseId, exercise);
      }

      await sleep(1000);
    }

    const exercises = Array.from(selectedExercises.values());
    console.log(`\nTotal unique exercises: ${exercises.length}\n`);

    const documents = [];
    for (let i = 0; i < exercises.length; i++) {
      documents.push(await mapExercise(exercises[i], i, exercises.length));
    }

    await Exercise.bulkWrite(
      documents.map((exercise) => ({
        updateOne: {
          filter: { externalId: exercise.externalId },
          update: { $set: exercise },
          upsert: true,
        },
      }))
    );

    console.log(`\nSuccessfully imported ${documents.length} exercises`);
    if (translationQuotaExceeded && !SKIP_TRANSLATION) {
      console.log(
        "Note: MyMemory quota was exceeded mid-run. Some/all Arabic fields fell back to English."
      );
      console.log("Re-run tomorrow, or with a MyMemory email key, to fill Arabic.");
    }

    console.log("\nExercises:");
    exercises.forEach((exercise, index) => {
      console.log(
        `${index + 1}. ${exercise.name} → ${(exercise.targetMuscles || []).join(", ")}`
      );
    });

    await mongoose.disconnect();
    console.log("\nMongoDB disconnected");
  } catch (error) {
    console.error("\nImport failed:", error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore disconnect errors
    }
    process.exit(1);
  }
}

importExercises();
