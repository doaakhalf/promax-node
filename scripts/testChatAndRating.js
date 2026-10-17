/**
 * Smoke + unit checks for chat contact guard and rating validation.
 *
 * Usage:
 *   node scripts/testChatAndRating.js
 *   node scripts/testChatAndRating.js --api
 *
 * API mode needs (in .env or env):
 *   API_BASE_URL   default http://localhost:3000
 *   CLIENT_API_KEY
 *   ATHLETE_TOKEN  Bearer access token for an athlete
 *   COACH_USER_ID  coach userId (same id used in subscribe / rating routes)
 * Optional:
 *   ADMIN_TOKEN, CONVERSATION_ID (coach_athlete thread for contact-block send test)
 */

import dotenv from "dotenv";
import { detectContactLeak } from "../utils/contactGuard.js";

dotenv.config({ override: true });

const COMMENT_MAX = 1000;
const ELIGIBLE_STATUSES = ["active", "expired"];

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function assertEq(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
  }
}

// --- Rating helpers (mirror RatingController validation) ---

function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readStars(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

function validateRatingBody({ stars, comment }) {
  const s = readStars(stars);
  const c = readText(comment);
  if (s == null) return { ok: false, message: "Stars must be an integer from 1 to 5" };
  if (!c || c.length > COMMENT_MAX) {
    return { ok: false, message: `Comment is required and must be at most ${COMMENT_MAX} characters` };
  }
  return { ok: true, stars: s, comment: c };
}

function canRateWithStatus(status) {
  return ELIGIBLE_STATUSES.includes(status);
}

function runContactGuardTests() {
  console.log("\n=== Chat: contactGuard ===");

  assertEq(detectContactLeak("3 reps of 10 kg")?.reason, undefined, "workout numbers allowed");
  assertEq(detectContactLeak("hello coach, ready for tomorrow")?.reason, undefined, "normal text allowed");

  assertEq(detectContactLeak("call me 01012345678")?.reason, "phone", "blocks Egyptian mobile");
  assertEq(detectContactLeak("0101 234 5678")?.reason, "phone", "blocks spaced phone");
  assertEq(detectContactLeak("٠١٠١٢٣٤٥٦٧٨")?.reason, "phone", "blocks Arabic-indic digits");

  // OCR path: body-comp receipts glue metrics; chat text still blocks long digit runs.
  const dixyLikeOcr =
    "CHECK ALL PROGRAM Gender Male Age 22 Height 181.5 cm Weight 80.45 kg BMI 24.3 " +
    "Fat 20.1% Water 54.9% Muscle 31.7% Bone 3.8 kg BMR 1930 kcal " +
    "18158045243 11702440 6179 www.DixyArabia.com";
  assertEq(
    detectContactLeak(dixyLikeOcr, [], { source: "ocr" })?.reason,
    undefined,
    "OCR allows Dixy/InBody-like measurement numbers"
  );
  assertEq(
    detectContactLeak("18158045243")?.reason,
    "phone",
    "chat text still blocks bare 10+ digit runs"
  );
  assertEq(
    detectContactLeak("call me 01012345678 Height 181.5 BMI 24.3", [], { source: "ocr" })?.reason,
    "phone",
    "OCR still blocks Egyptian mobile among metrics"
  );
  assertEq(
    detectContactLeak("0101 234 5678 Fat 20.1%", [], { source: "ocr" })?.reason,
    "phone",
    "OCR still blocks spaced Egyptian mobile"
  );
  assertEq(
    detectContactLeak("whatsapp +201012345678", [], { source: "ocr" })?.reason,
    "social",
    "OCR still blocks social keywords"
  );
  assertEq(
    detectContactLeak("reach me +201012345678 BMR 1930", [], { source: "ocr" })?.reason,
    "phone",
    "OCR blocks clear international + phone"
  );
  assertEq(
    detectContactLeak("Height 181.5 www.DixyArabia.com BMI 24.3", [], { source: "ocr" })?.reason,
    undefined,
    "OCR allows brand www on body-comp receipts"
  );
  assertEq(
    detectContactLeak("www.instagram.com/coach", [], { source: "ocr" })?.reason,
    "social",
    "OCR still blocks listed social domains"
  );
  assertEq(
    detectContactLeak("ig: ty ns CHECK ALL Gender Age 22 Height 181.5", [], { source: "ocr" })?.reason,
    undefined,
    "OCR ignores short ig token in receipt noise"
  );
  assertEq(
    detectContactLeak("whatsapp me Height 181.5", [], { source: "ocr" })?.reason,
    "social",
    "OCR still blocks long social keywords"
  );
  assertEq(
    detectContactLeak("see www.DixyArabia.com")?.reason,
    "social",
    "chat text still blocks arbitrary www links"
  );

  assertEq(detectContactLeak("whatsapp me")?.reason, "social", "blocks whatsapp keyword");
  assertEq(detectContactLeak("كلمني واتساب")?.reason, "social", "blocks Arabic whatsapp");
  assertEq(detectContactLeak("instagram.com/user")?.reason, "social", "blocks domain");
  assertEq(detectContactLeak("https://t.me/someone")?.reason, "social", "blocks telegram link");
  assertEq(detectContactLeak("ig")?.reason, "social", "blocks short ig keyword");
  assertEq(detectContactLeak("انستا")?.reason, "social", "blocks Arabic short keyword");
  assertEq(detectContactLeak("فيس")?.reason, "social", "blocks Arabic fb short keyword");

  assertEq(detectContactLeak("me@gmail.com")?.reason, "email", "blocks email");
  assertEq(detectContactLeak("follow @coachnamehere")?.reason, "handle", "blocks @handle");

  assertEq(
    detectContactLeak("زيرو عشره واحد صفر واحد اتنين تلاته اربعه خمسه سته سبعه")?.reason,
    "phone",
    "blocks Egyptian spelled digits with زيرو/عشره"
  );
  assertEq(
    detectContactLeak("zero ten one zero one two three four five six seven")?.reason,
    "phone",
    "blocks English spelled digits with ten"
  );
  assertEq(
    detectContactLeak("صفر واحد صفر واحد اتنين تلاته اربعه خمسه سته سبعه")?.reason,
    "phone",
    "blocks classic Arabic spelled mobile"
  );
  assertEq(detectContactLeak("زيرو عشره")?.reason, undefined, "short spelled prefix alone allowed");
  assertEq(
    detectContactLeak("زيرو حداشر اتنين تلاته اربعه خمسه سته سبعه تمانيه")?.reason,
    "phone",
    "blocks phone using حداشر"
  );
  assertEq(
    detectContactLeak("زيرو حداش اتنين تلاته اربعه خمسه سته سبعه تمانيه")?.reason,
    "phone",
    "blocks phone using clipped حداش"
  );
  assertEq(
    detectContactLeak("صفر اتناش تلتاش اربعتاش خمستاش ستاش")?.reason,
    "phone",
    "blocks phone using clipped teens 12-16"
  );

  // priorTexts is newest-first (same order ChatController loads recent messages)
  const split = detectContactLeak("5678", ["234", "0101"]);
  assertEq(split?.reason, "phone", "blocks split phone across messages");

  assertEq(
    detectContactLeak("اتنين تلاته اربعه خمسه", ["زيرو عشره", "واحد صفر واحد"])?.reason,
    "phone",
    "blocks spelled phone split across messages"
  );

  assertEq(detectContactLeak("5678")?.reason, undefined, "short digit fragment alone allowed");
  assertEq(
    detectContactLeak("5678", ["did 3 sets", "0101", "234"])?.reason,
    undefined,
    "non-digit newest prior breaks phone chain"
  );

  // Real abuse pattern: spelled chunks then single digits 0 / 10 / 1 / …
  assertEq(
    detectContactLeak("زيرو عشره حداشر خمسه", ["زيرو عشره خمسه اربعه"])?.reason,
    "phone",
    "blocks second spelled chunk chained with first"
  );
  assertEq(
    detectContactLeak("33", ["154", "1", "10", "0"])?.reason,
    "phone",
    "blocks Egyptian 01… chain by the 9th digit (0,10,1,154,33)"
  );
  assertEq(
    detectContactLeak("26", ["33", "154", "1", "10", "0"])?.reason,
    "phone",
    "blocks phone split as 0,10,1,154,33,26"
  );
  assertEq(
    detectContactLeak("1", ["10", "0"])?.reason,
    undefined,
    "short 010 chain alone still under threshold"
  );

  // Arabic digit-words split one message at a time (newest-first priors)
  assertEq(
    detectContactLeak("تلاته", ["اتنين", "حداشر", "اربعه", "خمسه", "عشره", "زيرو"])?.reason,
    "phone",
    "blocks Arabic sequential words زيرو/عشره/…/تلاته"
  );
  assertEq(
    detectContactLeak("تلاته سته", ["حداشر اتنين", "خمسه اربعه", "زيرو عشره"])?.reason,
    "phone",
    "blocks Arabic sequential short chunks"
  );
  assertEq(
    detectContactLeak("اربعه", ["خمسه", "عشره", "زيرو"])?.reason,
    undefined,
    "short Arabic sequence under threshold still allowed"
  );
}

function runRatingValidationTests() {
  console.log("\n=== Rating: body + eligibility ===");

  assert(validateRatingBody({ stars: 5, comment: "Great coach" }).ok, "valid 5-star rating");
  assert(validateRatingBody({ stars: 1, comment: "ok" }).ok, "valid 1-star rating");
  assert(!validateRatingBody({ stars: 0, comment: "x" }).ok, "rejects stars 0");
  assert(!validateRatingBody({ stars: 6, comment: "x" }).ok, "rejects stars 6");
  assert(!validateRatingBody({ stars: 3.5, comment: "x" }).ok, "rejects non-integer stars");
  assert(!validateRatingBody({ stars: "5", comment: "x" }).ok, "rejects string stars");
  assert(!validateRatingBody({ stars: 5, comment: "   " }).ok, "rejects blank comment");
  assert(!validateRatingBody({ stars: 5, comment: "a".repeat(1001) }).ok, "rejects comment > 1000");
  assert(validateRatingBody({ stars: 5, comment: "  trimmed  " }).comment === "trimmed", "trims comment");

  assert(canRateWithStatus("active"), "active subscription can rate");
  assert(canRateWithStatus("expired"), "expired subscription can rate");
  assert(!canRateWithStatus("pending"), "pending cannot rate");
  assert(!canRateWithStatus("cancelled"), "cancelled cannot rate");
}

async function apiRequest(path, { method = "GET", token, body, formData } = {}) {
  const base = (process.env.API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const headers = {
    "X-Api-Key": process.env.CLIENT_API_KEY || "",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${base}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function runApiSmoke() {
  console.log("\n=== API smoke (chat + rating) ===");

  const apiKey = process.env.CLIENT_API_KEY;
  const athleteToken = process.env.ATHLETE_TOKEN;
  const coachUserId = process.env.COACH_USER_ID;
  const adminToken = process.env.ADMIN_TOKEN;
  const conversationId = process.env.CONVERSATION_ID;

  if (!apiKey || !athleteToken || !coachUserId) {
    console.log(
      "  skip: set CLIENT_API_KEY, ATHLETE_TOKEN, COACH_USER_ID (and run with --api)"
    );
    return;
  }

  // Chat list
  {
    const { status, json } = await apiRequest("/api/chat/conversations", { token: athleteToken });
    assert(status === 200 && Array.isArray(json?.conversations), `GET /chat/conversations → ${status}`);
  }

  // Contact block on send (optional conversation)
  if (conversationId) {
    const form = new FormData();
    form.append("text", "whatsapp me please");
    const { status, json } = await apiRequest(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      token: athleteToken,
      formData: form,
    });
    assert(
      status === 403 && json?.code === "CONTACT_SHARING_BLOCKED",
      `POST contact leak blocked → ${status} ${json?.code || json?.message}`
    );
  } else {
    console.log("  · skip contact send: set CONVERSATION_ID for coach_athlete thread");
  }

  // Rating get
  {
    const { status, json } = await apiRequest(`/api/athlete/coaches/${coachUserId}/rating`, {
      token: athleteToken,
    });
    assert(
      status === 200 && json?.status === "success",
      `GET my rating → ${status} (data ${json?.data == null ? "null" : "present"})`
    );
  }

  // Rating upsert (safe: uses unique marker comment; updates if exists)
  const marker = `auto-test ${new Date().toISOString()}`;
  {
    const { status, json } = await apiRequest(`/api/athlete/coaches/${coachUserId}/rating`, {
      method: "PUT",
      token: athleteToken,
      body: { stars: 5, comment: marker },
    });
    const ok =
      (status === 200 || status === 201) &&
      json?.status === "success" &&
      json?.data?.stars === 5 &&
      json?.data?.comment === marker;
    assert(ok, `PUT rating → ${status} ${json?.message || json?.code || ""}`);
  }

  // Invalid stars
  {
    const { status, json } = await apiRequest(`/api/athlete/coaches/${coachUserId}/rating`, {
      method: "PUT",
      token: athleteToken,
      body: { stars: 9, comment: "bad" },
    });
    assert(status === 400, `PUT invalid stars → ${status} ${json?.message || ""}`);
  }

  // Public coach ratings list
  {
    const { status, json } = await apiRequest(`/api/coaches/${coachUserId}/ratings?page=1&limit=5`, {
      token: athleteToken,
    });
    assert(
      status === 200 && Array.isArray(json?.data) && json?.pagination,
      `GET coach ratings → ${status}`
    );
  }

  if (adminToken) {
    const { status, json } = await apiRequest("/api/admin/ratings?page=1&limit=5", {
      token: adminToken,
    });
    assert(status === 200 && Array.isArray(json?.data), `GET admin ratings → ${status}`);
  } else {
    console.log("  · skip admin ratings: set ADMIN_TOKEN");
  }
}

async function main() {
  console.log("Chat + Rating pre-deploy checks");
  runContactGuardTests();
  runRatingValidationTests();

  const wantApi = process.argv.includes("--api");
  if (wantApi) {
    await runApiSmoke();
  } else {
    console.log("\n=== API smoke ===");
    console.log("  skipped (pass --api with tokens to hit a running server)");
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
