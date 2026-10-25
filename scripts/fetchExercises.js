import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_URL = "https://oss.exercisedb.dev/api/v1/exercises";
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/exercisedb-en.json"
);

const STORED_MUSCLE_NAMES = {
  pectorals: "chest",
  quads: "quadriceps",
};

const PAGE_LIMIT = 25;
const REQUEST_DELAY_MS = 1200;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function buildDocument(exercise) {
  const targetBodyParts = [
    ...new Set(
      [...(exercise.bodyParts || []), ...(exercise.targetMuscles || [])].map(
        toStoredMuscleName
      )
    ),
  ];

  return {
    externalId: exerciseExternalId(exercise),
    name: exercise.name,
    type: mapExerciseType(exercise),
    targetBodyParts,
    instructions: toInstructionSteps(exercise.instructions),
    image: exercise.gifUrl,
    equipments: exercise.equipments || [],
    source: "exercisedb",
  };
}

async function getExercisesPage({ after } = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("limit", String(PAGE_LIMIT));
  if (after) url.searchParams.set("after", after);

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

    if (response.status === 429) {
      const waitMs = Math.min(5000 * attempt, 30000);
      console.log(`  rate limited, retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms…`);
      await sleep(waitMs);
      lastError = new Error(`ExerciseDB failed (429)`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`ExerciseDB failed (${response.status})`);
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error("ExerciseDB returned an unsuccessful response");
    }

    return {
      data: payload.data || [],
      meta: payload.meta || {},
    };
  }

  throw lastError || new Error("ExerciseDB request failed after retries");
}

async function fetchAllExercises() {
  const selected = new Map();
  let after = null;
  let page = 0;
  let total = null;

  while (true) {
    page += 1;
    console.log(
      after
        ? `Fetching page ${page} (after=${after})…`
        : `Fetching page ${page}…`
    );

    const { data, meta } = await getExercisesPage({ after });
    if (total == null && meta.total != null) total = meta.total;

    for (const exercise of data) {
      selected.set(exerciseExternalId(exercise), buildDocument(exercise));
    }

    console.log(
      `  got ${data.length} (unique so far: ${selected.size}${
        total != null ? ` / ${total}` : ""
      })`
    );

    if (!meta.hasNextPage || !meta.nextCursor) break;
    after = meta.nextCursor;
    await sleep(REQUEST_DELAY_MS);
  }

  return Array.from(selected.values()).sort((a, b) =>
    a.externalId.localeCompare(b.externalId)
  );
}

async function main() {
  try {
    const documents = await fetchAllExercises();
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    const tempPath = `${OUTPUT_PATH}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(documents, null, 2)}\n`);
    await fs.rename(tempPath, OUTPUT_PATH);
    console.log(`\nWrote ${documents.length} exercises to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("\nFailed:", error.message);
    process.exit(1);
  }
}

main();
