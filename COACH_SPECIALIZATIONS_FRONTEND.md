# تخصصات المدرب (`specializations`)

المدرب يقدر يختار **أكتر من تخصص** (حد أقصى 3 من غير تكرار).

القاعدة الأساسية: الفرونت **يعرض `label` (العربي)** للمستخدم، و**يبعت `value` (الكود الإنجليزي)** بس للسيرفر. الكود هو اللي بيتخزن، فممنوع تبعتي النص العربي نفسه في أي طلب.

كل الطلبات زي ما هي:

```http
X-Api-Key: <CLIENT_API_KEY>
Authorization: Bearer <access_token>   (ما عدا جلب القايمة — من غير توكن)
```

---

## 1. جلب قايمة التخصصات (لبناء شاشة الاختيار)

```http
GET /api/coach-specializations
```

من غير `Authorization` — شغالة قبل التسجيل/تسجيل الدخول.

```json
{
  "status": "success",
  "message": "Retrieved coach specializations successfully",
  "data": [
    { "value": "weight_gain_loss", "label": "زيادة وإنقاص الوزن", "labelAr": "زيادة وإنقاص الوزن", "labelEn": "Weight Gain & Loss" },
    { "value": "muscle_building", "label": "بناء العضلات", "labelAr": "بناء العضلات", "labelEn": "Muscle Building" },
    { "value": "bodybuilding", "label": "كمال الأجسام", "labelAr": "كمال الأجسام", "labelEn": "Bodybuilding" },
    { "value": "strength_training", "label": "تدريب القوة", "labelAr": "تدريب القوة", "labelEn": "Strength Training" },
    { "value": "fitness", "label": "لياقة بدنية", "labelAr": "لياقة بدنية", "labelEn": "Fitness" },
    { "value": "crossfit", "label": "كروس فيت", "labelAr": "كروس فيت", "labelEn": "CrossFit" },
    { "value": "cardio_endurance", "label": "كارديو وتحمّل", "labelAr": "كارديو وتحمّل", "labelEn": "Cardio & Endurance" },
    { "value": "sports_nutrition", "label": "التغذية الرياضية", "labelAr": "التغذية الرياضية", "labelEn": "Sports Nutrition" },
    { "value": "flexibility_mobility", "label": "المرونة والحركة", "labelAr": "المرونة والحركة", "labelEn": "Flexibility & Mobility" },
    { "value": "pilates", "label": "بيلاتس", "labelAr": "بيلاتس", "labelEn": "Pilates" },
    { "value": "home_workout", "label": "تدريب منزلي", "labelAr": "تدريب منزلي", "labelEn": "Home Workout" }
  ]
}
```

> متعرّفيش القايمة عندك في الكود — هاتيها من الـ endpoint ده، عشان لو زوّدنا تخصص جديد يظهر عندك من غير تحديث للتطبيق.

---

## 2. الإرسال (تسجيل مدرب جديد / تعديل البروفايل)

ابعتـي `specializations` كمصفوفة من الـ `value` بس:

```json
{
  "specializations": ["weight_gain_loss", "muscle_building", "sports_nutrition"]
}
```

- **تسجيل مدرب (Google/Apple)**: نفس الحقل ده يتبعت مع باقي بيانات إكمال البروفايل (`POST /api/auth/google/complete` أو `/api/auth/apple/complete`) — الحقل اختياري.
- **تعديل البروفايل العام**: `PUT /api/coaches/edit` (نفس الـ `multipart/form-data` الحالي؛ ينفع تبعتيها كحقل JSON string بالشكل ده: `specializations: "[\"weight_gain_loss\",\"fitness\"]"`).
- **تعديل التخصصات بس**: استخدمي الـ API المخصصة في خطوة 3 تحت — أسرع ومش بتحتاج مراجعة أدمن.
- الحقل **اختياري**: لو مبعتيهوش خالص، القيمة الحالية بتفضل زي ما هي.
- لو بعتّي **`[]` فاضية**، ده معناه مسح كل التخصصات (في التعديل بس).

### أخطاء التحقق (`422`)

```json
{
  "message": "Validation error",
  "errors": {
    "specializations": "تخصص غير صحيح: \"xxx\". يرجى الاختيار من قائمة التخصصات المتاحة"
  }
}
```

بتحصل لو: كود مش موجود في القايمة، أو أكتر من 3 تخصصات (`يمكن اختيار3 تخصصات كحد أقصى`). التكرار بيتمسح تلقائيًا ومش بيسبب خطأ. رسائل الخطأ بالعربي، اعرضيها للمستخدم زي ما هي.

---

## 3. تعديل التخصصات بس (API مخصصة للمدرب)

دي الـ API اللي تستخدميها لو الشاشة هدفها تعديل التخصصات لوحدها، من غير ما تبعتي بيانات البروفايل كلها.

```http
PUT /api/coaches/specializations
Authorization: Bearer <access_token>   (توكن مدرب بس)
Content-Type: application/json
```

### الـ Request

ابعتـي القايمة **الكاملة** بعد التعديل — دي عملية استبدال (Replace)، مش إضافة على اللي موجود:

```json
{
  "specializations": ["weight_gain_loss", "muscle_building"]
}
```

- الحقل **إجباري هنا**: لو مبعتيهوش هترجع `422` برسالة `يجب إرسال التخصصات المطلوب حفظها`.
- ابعتـي **`[]` فاضية** لو عايزة تمسحي كل التخصصات.
- حد أقصى 3، والتكرار بيتمسح تلقائيًا.
- الـ `value` بس (الكود الإنجليزي من خطوة 1) — ممنوع النص العربي.

### الـ Response (`200`)

بيرجع التخصصات الجديدة جاهزة للعرض بالعربي:

```json
{
  "status": "success",
  "message": "Coach specializations updated successfully",
  "data": {
    "specializations": [
      { "value": "weight_gain_loss", "label": "زيادة وإنقاص الوزن", "labelAr": "زيادة وإنقاص الوزن", "labelEn": "Weight Gain & Loss" },
      { "value": "muscle_building", "label": "بناء العضلات", "labelAr": "بناء العضلات", "labelEn": "Muscle Building" }
    ]
  }
}
```

### ملحوظات مهمة

- **بتتنفذ فورًا** — الـ API دي مستثناة من مراجعة الأدمن، والتخصصات الجديدة بتظهر للرياضيين على طول (عكس تعديل البروفايل العام).
- للمدرب بس: توكن رياضي أو أدمن هيرجع `403`، ومن غير توكن `401`.
- لو حساب المدرب مش موجود أصلًا هترجع `404` برسالة `Coach not found`.
- أخطاء التحقق نفس شكل خطوة 2 بالظبط (`422` + `errors.specializations` بالعربي).

---

## 4. الاستلام (عرض بروفايل/قايمة المدربين)

في أي رد فيه بيانات مدرب (بروفايل المدرب `GET /api/coaches/my-profile/:id`، وقايمة المدربين للرياضي `GET /api/coaches`) بيوصلك الحقل بالشكل ده:

```json
{
  "sport": "Fitness",
  "specializations": [
    { "value": "weight_gain_loss", "label": "زيادة وإنقاص الوزن", "labelAr": "زيادة وإنقاص الوزن", "labelEn": "Weight Gain & Loss" },
    { "value": "sports_nutrition", "label": "التغذية الرياضية", "labelAr": "التغذية الرياضية", "labelEn": "Sports Nutrition" }
  ]
}
```

- اعرضي `label` (العربي) على طول — مش محتاجة أي mapping عندك.
- لو المدرب لسه مختارش تخصصات، بيوصلك `"specializations": []`.
- عشان تعرفي التخصصات المختارة مسبقًا في شاشة التعديل، قارني `value` بتاعة القايمة (من خطوة 1) مع `value` اللي في البروفايل.

---

## ملحوظة عن تعديل البروفايل

تعديل البروفايل العام (`PUT /api/coaches/edit`) لمدرب **مفعّل** بيروح مراجعة أدمن الأول زي باقي الحقول، وبيظهر للرياضيين بعد الموافقة بس. تعديل مدرب لسه `pending` بيتنفذ فورًا.

الاستثناء الوحيد: الـ API المخصصة للتخصصات (`PUT /api/coaches/specializations` — خطوة 3) بتتنفذ **فورًا دايمًا** ومش بتمر على مراجعة الأدمن.
