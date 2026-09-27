import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_URL = "https://oss.exercisedb.dev/api/v1/exercises";
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/exercisedb-en.json"
);

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

const EXERCISES_PER_MUSCLE = 30;

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

async function fetchExercises() {
  const selected = new Map();

  for (const muscle of TARGET_MUSCLES) {
    const queryMuscle = API_MUSCLE_NAMES[muscle] || muscle;
    console.log(
      `Fetching ${EXERCISES_PER_MUSCLE} exercises for: ${muscle} (${queryMuscle})`
    );
    const exercises = await getExercisesByMuscle(queryMuscle);
    console.log(`Found ${exercises.length} exercises`);

    for (const exercise of exercises) {
      selected.set(exerciseExternalId(exercise), buildDocument(exercise));
    }

    await sleep(1000);
  }

  return Array.from(selected.values()).sort((a, b) =>
    a.externalId.localeCompare(b.externalId)
  );
}

async function main() {
  try {
    const documents = await fetchExercises();
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
