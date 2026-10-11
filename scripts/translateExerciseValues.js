import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const INPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/exercisedb-en.json"
);
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/exercisedb-ar-values.json"
);

const TYPE_AR = {
  Strength: "قوة",
  Cardio: "كارديو",
  Flexibility: "مرونة",
};

const PARTS_AR = {
  chest: "صدر",
  quadriceps: "أمامي الفخذ",
  hamstrings: "خلفي الفخذ",
  glutes: "جلوت",
  calves: "سمّانة",
  abs: "بطن",
  lats: "لاتس",
  delts: "أكتاف",
  biceps: "باي",
  triceps: "تراي",
  back: "ظهر",
  shoulders: "أكتاف",
  waist: "وسط",
  "upper arms": "ذراع",
  "upper legs": "رجل",
  "lower legs": "سمّانة",
};

const EQUIP_AR = {
  assisted: "بمساعدة",
  band: "استك",
  barbell: "بار",
  "body weight": "بوزن الجسم",
  "bosu ball": "بوسو بول",
  cable: "كيبل",
  dumbbell: "دمبل",
  "ez barbell": "بار EZ",
  kettlebell: "كيتل بل",
  "leverage machine": "جهاز",
  "medicine ball": "ميديسين بول",
  "resistance band": "استك مقاومة",
  roller: "رولر",
  rope: "حبل",
  "sled machine": "مكبس",
  "smith machine": "جهاز سميث",
  "stability ball": "كرة توازن",
  weighted: "بوزن إضافي",
};

const EQUIPMENT = [
  ["ez barbell", "بار EZ"],
  ["ez bar", "بار EZ"],
  ["resistance band", "استك مقاومة"],
  ["stability ball", "كرة توازن"],
  ["exercise ball", "كرة تمارين"],
  ["medicine ball", "ميديسين بول"],
  ["bosu ball", "بوسو بول"],
  ["smith machine", "جهاز سميث"],
  ["smith", "سميث"],
  ["kettlebell", "كيتل بل"],
  ["dumbbells", "دمبل"],
  ["dumbbell", "دمبل"],
  ["barbell", "بار"],
  ["cable", "كيبل"],
  ["band", "استك"],
  ["roller", "رولر"],
  ["rope", "حبل"],
  ["sled", "مكبس"],
  ["lever", "جهاز"],
  ["assisted", "بمساعدة"],
  ["weighted", "بوزن إضافي"],
];

const EQUIPMENT_WITH = {
  "بار EZ": "ببار EZ",
  "استك مقاومة": "باستك مقاومة",
  "كرة توازن": "بكرة التوازن",
  "كرة تمارين": "بكرة التمارين",
  "ميديسين بول": "بالميديسين بول",
  "بوسو بول": "بالبوسو بول",
  سميث: "بالسميث",
  "جهاز سميث": "بجهاز سميث",
  "كيتل بل": "بالكيتل بل",
  دمبل: "بالدمبل",
  بار: "بالبار",
  كيبل: "بالكيبل",
  استك: "بالاستك",
  رولر: "بالرولر",
  حبل: "بالحبل",
  مكبس: "بالمكبس",
  جهاز: "بالجهاز",
  بمساعدة: "بمساعدة",
  "بوزن إضافي": "بوزن إضافي",
};

const MOVEMENTS = [
  ["straight leg deadlift", "ديدليفت رجلين مفرود"],
  ["stiff leg deadlift", "ديدليفت رجلين مفرود"],
  ["side deadlift", "ديدليفت جانبي"],
  ["deadlift", "ديدليفت"],
  ["overhead squat", "سكوات أوفر هيد"],
  ["pistol squat", "بيستول سكوات"],
  ["sissy squat", "سيسي سكوات"],
  ["hack squat", "هاك سكوات"],
  ["split squat", "سبليت سكوات"],
  ["split squats", "سبليت سكوات"],
  ["jump squat", "سكوات قفز"],
  ["chair squat", "سكوات على كرسي"],
  ["squat jerk", "سكوات جيرك"],
  ["potty squat", "سكوات عميق"],
  ["squat", "سكوات"],
  ["good morning", "جود مورنينج"],
  ["bench press", "ضغط بنش"],
  ["shoulder press", "ضغط أكتاف"],
  ["leg press", "ليج برس"],
  ["calf press", "ضغط سمّانة"],
  ["incline press", "ضغط مائل"],
  ["decline press", "ضغط مائل لأسفل"],
  ["chest press", "ضغط صدر"],
  ["french press", "فرنش برس"],
  ["scott press", "سكوت برس"],
  ["close grip press", "ضغط قبضة ضيقة"],
  ["hammer press", "هامر برس"],
  ["press", "ضغط"],
  ["upright row", "تجديف عالي"],
  ["rear fly", "فلاي خلفي"],
  ["lateral raise", "رفع جانبي"],
  ["front raise", "رفع أمامي"],
  ["calf raise", "رفع سمّانة"],
  ["knee raise", "رفع ركبة"],
  ["leg raise", "رفع رجل"],
  ["hip raise", "رفع حوض"],
  ["hip lift", "رفع حوض"],
  ["y-raise", "رفع Y"],
  ["glute-ham raise", "جلوت هام ريز"],
  ["raise", "رفع"],
  ["lat pulldown", "سحب لاتس"],
  ["pulldown", "سحب"],
  ["pull-up", "عقلة"],
  ["pull up", "عقلة"],
  ["chin-up", "عقلة قبضة عكسية"],
  ["push-up", "ضغط أرضي"],
  ["pushdown", "بوش داون"],
  ["preacher curl", "كيرل بريشر"],
  ["hammer curl", "هامر كيرل"],
  ["bicep curl", "كيرل باي"],
  ["biceps curl", "كيرل باي"],
  ["leg curl", "ليج كيرل"],
  ["spider curl", "سبايدر كيرل"],
  ["reverse curl", "كيرل عكسي"],
  ["curl", "كيرل"],
  ["triceps extension", "اكستنشن تراي"],
  ["tricep extension", "اكستنشن تراي"],
  ["leg extension", "ليج إكستنشن"],
  ["extension", "اكستنشن"],
  ["flyes", "فلاي"],
  ["fly", "فلاي"],
  ["cross-over", "كروس أوفر"],
  ["pullover", "بول أوفر"],
  ["muscle-up", "ماسل أب"],
  ["sit-up", "سيت أب"],
  ["crunch", "كرنش"],
  ["side plank", "بلانك جانبي"],
  ["plank", "بلانك"],
  ["lunge", "لونج"],
  ["stretch", "إطالة"],
  ["power clean", "باور كلين"],
  ["hang clean", "هانج كلين"],
  ["clean", "كلين"],
  ["snatch pull", "سحب سناتش"],
  ["snatch", "سناتش"],
  ["dips", "ديبس"],
  ["dip", "ديبس"],
  ["row", "تجديف"],
  ["twist", "لف"],
  ["kick", "ركلة"],
  ["air bike", "إير بايك"],
  ["step-up", "ستيب أب"],
  ["step up", "ستيب أب"],
];

const MODIFIERS = [
  ["close-grip", "قبضة ضيقة"],
  ["close grip", "قبضة ضيقة"],
  ["wide grip", "قبضة عريضة"],
  ["reverse grip", "قبضة عكسية"],
  ["reverse-grip", "قبضة عكسية"],
  ["neutral grip", "قبضة متوازية"],
  ["underhand", "قبضة سفلية"],
  ["overhand", "قبضة علوية"],
  ["one arm", "ذراع واحدة"],
  ["one leg", "رجل واحدة"],
  ["single leg", "رجل واحدة"],
  ["two arm", "ذراعين"],
  ["two-one", "رجلين ثم رجل"],
  ["bent over", "منحني"],
  ["bent knee", "ركبة مثنية"],
  ["bent arm", "ذراع مثنية"],
  ["straight leg", "رجل مفرودة"],
  ["incline", "مائل"],
  ["decline", "مائل لأسفل"],
  ["overhead", "فوق الرأس"],
  ["seated", "جالس"],
  ["standing", "واقف"],
  ["lying", "نائم"],
  ["kneeling", "راكع"],
  ["hanging", "معلّق"],
  ["alternating", "بالتبادل"],
  ["alternate", "بالتبادل"],
  ["behind head", "خلف الرأس"],
  ["behind neck", "خلف الرقبة"],
  ["on floor", "على الأرض"],
];

const STEP_PHRASES = [
  ["repeat for the desired number of repetitions, then switch legs", "كرر العدد المطلوب من العدات، وبعدين بدّل الرجل"],
  ["repeat for the desired number of repetitions, then switch to the other leg", "كرر العدد المطلوب من العدات، وبعدين بدّل للرجل التانية"],
  ["repeat for the desired number of repetitions, then switch to the other arm", "كرر العدد المطلوب من العدات، وبعدين بدّل للذراع التانية"],
  ["repeat for the desired number of repetitions", "كرر العدد المطلوب من العدات"],
  ["continue alternating sides for the desired number of repetitions", "كمّل بالتبادل بين الجهتين للعدد المطلوب"],
  ["continue alternating legs for the desired number of repetitions", "كمّل بالتبادل بين الرجلين للعدد المطلوب"],
  ["slowly lower your upper body back down to the starting position", "انزل بالجزء العلوي ببطء لوضع البداية"],
  ["slowly lower your heels back down to the starting position", "انزل بكعبيك ببطء لوضع البداية"],
  ["slowly lower your legs back down to the starting position", "انزل برجليك ببطء لوضع البداية"],
  ["slowly lower your body back down to the starting position", "انزل بجسمك ببطء لوضع البداية"],
  ["push yourself back up to the starting position", "ارجع لفوق لوضع البداية"],
  ["return to the starting position", "ارجع لوضع البداية"],
  ["back down to the starting position", "لوضع البداية"],
  ["to the starting position", "لوضع البداية"],
  ["the starting position", "وضع البداية"],
  ["starting position", "وضع البداية"],
  ["hold the stretch for 20-30 seconds", "اثبت في الإطالة من 20 إلى 30 ثانية"],
  ["hold this position for a few breaths", "اثبت في الوضع كام نفس"],
  ["hold the contracted position for a brief pause as you squeeze your biceps", "اثبت لحظة واضغط على الباي"],
  ["pause for a moment at the top of the movement", "اثبت لحظة في أعلى الحركة"],
  ["pause for a moment at the top", "اثبت لحظة فوق"],
  ["pause for a moment at the bottom", "اثبت لحظة تحت"],
  ["pause for a moment", "اثبت لحظة"],
  ["push through your heels", "ادفع من الكعب"],
  ["feet shoulder-width apart", "قدميك بعرض الأكتاف"],
  ["shoulder-width apart", "بعرض الأكتاف"],
  ["palms facing away from you", "الكفوف لبره"],
  ["palms facing your torso", "الكفوف ناحية جسمك"],
  ["palms facing forward", "الكفوف لقدام"],
  ["overhand grip", "قبضة علوية"],
  ["underhand grip", "قبضة سفلية"],
  ["neutral grip", "قبضة متوازية"],
  ["arms fully extended", "الذراعين مفرودين"],
  ["arms extended", "الذراعين مفرودين"],
  ["lie face down on the floor", "نام على بطنك على الأرض"],
  ["lie flat on your back", "نام على ظهرك"],
  ["lie flat on a bench", "نام على البنش"],
  ["lie on your back", "نام على ظهرك"],
  ["sit on a bench", "اقعد على البنش"],
  ["sit on the bench", "اقعد على البنش"],
  ["stand up straight", "قف مفرود"],
  ["stand with your feet shoulder-width apart", "قف وقدميك بعرض الأكتاف"],
  ["stand with your feet", "قف وقدميك"],
  ["stand facing away from the machine", "قف وظهرك للجهاز"],
  ["stand facing the machine", "قف ووشك للجهاز"],
  ["hang from a pull-up bar", "اتعلّق في بار العقلة"],
  ["pull-up bar", "بار العقلة"],
  ["knees bent and feet flat on the ground", "ركب مثنية وقدميك ثابتين على الأرض"],
  ["feet flat on the ground", "قدميك ثابتين على الأرض"],
  ["flat on the ground", "على الأرض"],
  ["on the ground", "على الأرض"],
  ["off the ground", "عن الأرض"],
  ["hands behind your head", "إيديك خلف راسك"],
  ["place your hands", "حط إيديك"],
  ["elbows pointing outwards", "الكوعين لبره"],
  ["engage your core muscles", "شد عضلات وسطك"],
  ["engage your core", "شد وسطك"],
  ["engaging your abs", "وأنت شدان بطنك"],
  ["keep your body in a straight line from head to toe", "خليك مفرود من راسك لرجليك"],
  ["keep your back straight", "ظهرك يفضل مفرود"],
  ["back straight", "ظهر مفرود"],
  ["upper arms are parallel to the ground", "أعلى الذراع يوازي الأرض"],
  ["parallel to the ground", "موازي للأرض"],
  ["parallel to the floor", "موازي للأرض"],
  ["45-degree angle", "زاوية 45"],
  ["upper body", "الجزء العلوي"],
  ["lower your body by bending your elbows", "انزل بجسمك بثني الكوع"],
  ["lower your body", "انزل بجسمك"],
  ["lift your knees towards your chest", "ارفع ركبتيك ناحية صدرك"],
  ["lift your knees", "ارفع ركبتيك"],
  ["lift your upper body off the ground", "ارفع الجزء العلوي عن الأرض"],
  ["lift one foot off the ground", "ارفع رجل عن الأرض"],
  ["squeeze your abs", "اضغط على بطنك"],
  ["squeeze your biceps", "اضغط على الباي"],
  ["squeeze your glutes", "اضغط على الجلوت"],
  ["your chest", "صدرك"],
  ["your biceps", "الباي"],
  ["your triceps", "التراي"],
  ["your shoulders", "أكتافك"],
  ["your heels", "كعبيك"],
  ["your elbows", "كوعك"],
  ["your knees", "ركبتيك"],
  ["your legs", "رجليك"],
  ["your arms", "ذراعيك"],
  ["your hands", "إيديك"],
  ["your feet", "قدميك"],
  ["your back", "ظهرك"],
  ["your core", "وسطك"],
  ["your hips", "حوضك"],
  ["your head", "راسك"],
  ["your torso", "جذعك"],
  ["dumbbell in each hand", "دمبل في كل إيد"],
  ["in each hand", "في كل إيد"],
  ["stability ball", "كرة التوازن"],
  ["exercise ball", "كرة التمارين"],
  ["set up an incline bench", "اظبط بنش مائل"],
  ["incline bench", "بنش مائل"],
  ["slowly", "ببطء"],
  ["fully extended", "مفرود تمام"],
  ["bending your elbows", "بثي الكوع"],
  ["straightening your arms", "بفرد الذراعين"],
  ["switch legs", "بدّل الرجل"],
  ["switch arms", "بدّل الذراع"],
  ["other leg", "الرجل التانية"],
  ["other arm", "الذراع التانية"],
  ["one leg", "رجل واحدة"],
  ["one arm", "ذراع واحدة"],
];

const STEP_WORDS = [
  ["shoulders", "أكتاف"],
  ["shoulder", "كتف"],
  ["biceps", "باي"],
  ["triceps", "تراي"],
  ["hamstrings", "خلفي الفخذ"],
  ["quadriceps", "أمامي الفخذ"],
  ["glutes", "جلوت"],
  ["calves", "سمّانة"],
  ["chest", "صدر"],
  ["elbows", "كوع"],
  ["elbow", "كوع"],
  ["knees", "ركب"],
  ["knee", "ركبة"],
  ["heels", "كعب"],
  ["toes", "صوابع الرجل"],
  ["hands", "إيديك"],
  ["hand", "إيد"],
  ["palms", "الكفوف"],
  ["legs", "رجلين"],
  ["leg", "رجل"],
  ["arms", "ذراعين"],
  ["arm", "ذراع"],
  ["feet", "قدمين"],
  ["foot", "قدم"],
  ["hips", "حوض"],
  ["hip", "حوض"],
  ["back", "ظهر"],
  ["body", "جسم"],
  ["bench", "بنش"],
  ["machine", "جهاز"],
  ["handles", "مقابض"],
  ["handle", "مقبض"],
  ["position", "وضع"],
  ["movement", "حركة"],
  ["repetitions", "عدات"],
  ["repetition", "عدة"],
  ["stretch", "إطالة"],
  ["ground", "الأرض"],
  ["floor", "الأرض"],
  ["slowly", "ببطء"],
  ["straight", "مفرود"],
  ["forward", "لقدام"],
  ["backward", "لوراء"],
  ["upwards", "لفوق"],
  ["downwards", "لتحت"],
  ["together", "مع بعض"],
  ["apart", "متباعدين"],
  ["slightly", "شوية"],
  ["fully", "تمام"],
  ["hold", "اثبت"],
  ["lift", "ارفع"],
  ["lower", "انزل"],
  ["push", "ادفع"],
  ["pull", "اسحب"],
  ["bend", "اثني"],
  ["extend", "افرد"],
  ["squeeze", "اضغط"],
  ["engage", "شد"],
  ["keep", "خلّي"],
  ["keeping", "وخلي"],
  ["place", "حط"],
  ["grasp", "امسك"],
  ["stand", "قف"],
  ["sit", "اقعد"],
  ["lie", "نام"],
  ["repeat", "كرر"],
  ["pause", "اثبت"],
  ["return", "ارجع"],
  ["switch", "بدّل"],
  ["continue", "كمّل"],
  ["towards", "ناحية"],
  ["until", "لحد"],
  ["then", "وبعدين"],
  ["lowering", "وأنت بتنزل"],
  ["yourself", "نفسك"],
  ["through", "من"],
  ["bring", "جيب"],
  ["away", "بعيد"],
  ["resting", "مرتاح"],
  ["degree", "درجة"],
  ["ankles", "الكاحلين"],
  ["ankle", "الكاحل"],
  ["control", "بتحكم"],
  ["release", "ارخي"],
  ["contracting", "وأنت بتقلّص"],
  ["support", "سند"],
  ["across", "عبر"],
  ["pushing", "وأنت بتدفع"],
  ["rotate", "لف"],
  ["slight", "بسيط"],
  ["using", "باستخدام"],
  ["upward", "لفوق"],
  ["blades", "لوحي الكتف"],
  ["backrest", "ظهر البنش"],
  ["take", "خد"],
  ["step", "خطوة"],
  ["your", ""],
  ["the", ""],
  ["and", "و"],
  ["from", "من"],
  ["into", "لـ"],
  ["onto", "على"],
  ["over", "فوق"],
  ["under", "تحت"],
  ["this", "هذا"],
  ["that", "ده"],
  ["each", "كل"],
  ["both", "الاتنين"],
  ["side", "جنب"],
  ["sides", "الجنبين"],
  ["top", "فوق"],
  ["bottom", "تحت"],
  ["left", "الشمال"],
  ["right", "اليمين"],
  ["other", "التاني"],
  ["while", "وأنت"],
  ["without", "من غير"],
  ["desired", "المطلوب"],
  ["number", "عدد"],
  ["brief", "قصيرة"],
  ["moment", "لحظة"],
  ["seconds", "ثواني"],
  ["breaths", "أنفاس"],
  ["angle", "زاوية"],
  ["grip", "قبضة"],
  ["weight", "وزن"],
  ["bar", "بار"],
  ["ball", "كرة"],
  ["facing", "باتجاه"],
  ["front", "أمامي"],
  ["upper", "أعلى"],
  ["holding", "وأنت ماسك"],
  ["extended", "مفرود"],
  ["extending", "وأنت بتفرد"],
  ["squeezing", "وأنت بتضغط"],
  ["bending", "وأنت بتثني"],
  ["behind", "خلف"],
  ["bringing", "وجيب"],
  ["adjust", "اظبط"],
  ["bent", "مثني"],
  ["close", "ضيق"],
  ["wider", "أعرض"],
  ["down", "لتحت"],
  ["high", "عالٍ"],
  ["above", "فوق"],
  ["against", "على"],
  ["exhale", "اطلع النفس"],
  ["inhale", "خد نفس"],
  ["stationary", "ثابت"],
  ["throughout", "طول الحركة"],
  ["possible", "قد ما تقدر"],
  ["pointing", "موجّه"],
  ["lifting", "وأنت بترفع"],
  ["engaged", "مشدود"],
  ["attach", "ركّب"],
  ["contracted", "في وضع الانقباض"],
  ["footplate", "دواسة الجهاز"],
  ["thighs", "الفخذين"],
  ["height", "ارتفاع"],
  ["level", "مستوى"],
  ["lean", "ميل"],
  ["pad", "المسند"],
  ["muscles", "العضلات"],
  ["weights", "الأوزان"],
  ["width", "عرض"],
  ["seat", "المقعد"],
  ["heel", "الكعب"],
  ["stability", "توازن"],
  ["one", "واحد"],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyPhrases(text, phrases) {
  let output = ` ${text} `;
  const sorted = [...phrases].sort((a, b) => b[0].length - a[0].length);
  for (const [english, arabic] of sorted) {
    output = output.replace(
      new RegExp(`(^|[^\\p{L}])${escapeRegExp(english)}(?=$|[^\\p{L}])`, "giu"),
      `$1${arabic}`
    );
  }
  return output.replace(/\s+/g, " ").trim();
}

function takeMatch(source, phrases) {
  const lower = source.toLowerCase();
  const sorted = [...phrases].sort((a, b) => b[0].length - a[0].length);
  for (const [english, arabic] of sorted) {
    const index = lower.indexOf(english);
    if (index === -1) continue;
    const before = lower[index - 1];
    const after = lower[index + english.length];
    if (before && /[a-z]/i.test(before)) continue;
    if (after && /[a-z]/i.test(after)) continue;
    const next = `${source.slice(0, index)} ${source.slice(index + english.length)}`;
    return { arabic, rest: next.replace(/\s+/g, " ").trim() };
  }
  return null;
}

function translateName(name) {
  let rest = String(name)
    .replace(/\(.*?\)/g, " ")
    .replace(/\bv\.\s*\d+\b/gi, " ")
    .replace(
      /\b(male|female|variation|improved|horizontal|traditional|pure|simple|classic|intensified|modified|elevated|pointed|fast|rough|fluid|gentle|narrow|rounded|targeted|inverted|flexible|self|quick|triple|single|dynamic|rear|rocky|impossible|advanced|core|hack|runners|world|greatest|posterior|tibialis|femoral|isolation|complex|sequence|pose|squad|style)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  const equipment = [];
  let found = takeMatch(rest, EQUIPMENT);
  while (found) {
    equipment.push(found.arabic);
    rest = found.rest;
    found = takeMatch(rest, EQUIPMENT);
  }

  const modifiers = [];
  found = takeMatch(rest, MODIFIERS);
  while (found) {
    modifiers.push(found.arabic);
    rest = found.rest;
    found = takeMatch(rest, MODIFIERS);
  }

  const movement = takeMatch(rest, MOVEMENTS);
  const movementAr = movement ? movement.arabic : "";
  rest = movement ? movement.rest : rest;
  rest = rest
    .replace(/\b(with|and|on|the|a|an|of|to|from|in|for|by|at|or)\b/gi, " ")
    .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const leftover = rest
    ? applyPhrases(rest, [...MOVEMENTS, ...MODIFIERS])
        .replace(/\b[a-z][a-z'-]*\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";

  const parts = [movementAr, ...modifiers, leftover];
  if (equipment.length) {
    parts.push(equipment.map((item) => EQUIPMENT_WITH[item] || item).join(" و"));
  }
  const translated = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return translated || name;
}

function translateStep(step) {
  const match = String(step).match(/^Step:(\d+)\s*(.*)$/i);
  let body = match ? match[2] : String(step);
  body = applyPhrases(body, STEP_PHRASES);
  body = applyPhrases(body, EQUIPMENT);
  body = applyPhrases(body, MOVEMENTS);
  body = applyPhrases(body, MODIFIERS);
  body = applyPhrases(body, STEP_WORDS);
  body = body
    .replace(/\b(a|an|the|your|you|of|to|for|as|at|by|is|are|be|been|was|were|it|its|this|that|on|in|or|with|and|than|out|off|up|them|start)\b/gi, " ")
    .replace(/\s+([،.])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!match) return body;
  return `الخطوة ${match[1]}: ${body}`;
}

function translateList(values, dictionary) {
  return (values || []).map((value) => dictionary[String(value).toLowerCase()] || dictionary[value] || value);
}

function translateExercise(exercise) {
  return {
    externalId: exercise.externalId,
    name: translateName(exercise.name),
    type: TYPE_AR[exercise.type] || exercise.type,
    targetBodyParts: [...new Set(translateList(exercise.targetBodyParts, PARTS_AR))],
    instructions: (exercise.instructions || []).map(translateStep),
    image: exercise.image,
    equipments: translateList(exercise.equipments, EQUIP_AR),
    source: exercise.source,
  };
}

async function main() {
  const exercises = JSON.parse(await fs.readFile(INPUT_PATH, "utf8"));
  const translated = exercises.map(translateExercise);
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const tempPath = `${OUTPUT_PATH}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(translated, null, 2)}\n`);
  await fs.rename(tempPath, OUTPUT_PATH);
  console.log(`Wrote ${translated.length} exercises to ${OUTPUT_PATH}`);
}

main();
