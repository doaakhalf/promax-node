# تغذية الكوتش — دليل الفرونت

الكوتش يقدر يدي اللاعب التغذية بثلاث طرق مستقلة. لا تستبدلوا طريقة بطريقة.

| الطريقة | أين تتحفظ | ماذا تمسح |
|---|---|---|
| رفع ملف | `subscription.nutritionFile` | تمسح النص فقط |
| كتابة نص | `subscription.nutritionText` | تمسح الملف فقط |
| خطة أسبوعية | `NutritionAssignment` على نفس الاشتراك | لا تمسح الملف ولا النص |

تعيين الخطة الأسبوعية لا يمسح الملف أو النص. رفع ملف أو كتابة نص لا يمسح الخطة الأسبوعية.

## عام

- الأساس: `/api`
- كل الطلبات تحت `/api` تحتاج `Authorization: Bearer <token>`
- في الإنتاج أرسلوا أيضاً `X-Api-Key`
- الدور المطلوب لطرق الكوتش: `coach`
- عرض الخطة الأسبوعية المعيّنة متاح للكوتش صاحب الاشتراك وللاعب صاحب الاشتراك

شكل النجاح:

```json
{
  "status": "success",
  "message": "...",
  "data": {},
  "pagination": {}
}
```

`pagination` تظهر في القوائم فقط.

شكل الخطأ من خدمات التغذية:

```json
{ "success": false, "message": "..." }
```

أخطاء المصادقة قد ترجع `status: "error"` بدل `success`.

ترقيم الصفحات: `page` يبدأ من 1، و`limit` الافتراضي 20 والحد الأقصى 200.

```json
{
  "page": 1,
  "limit": 20,
  "total": 200,
  "totalPages": 10,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

القيم الثابتة:

- نوع الوجبة: `breakfast` | `lunch` | `dinner` | `snack`
- هدف الخطة: `cutting` | `bulking` | `maintenance`
- أيام الخطة: `dayNumber` من 1 إلى 7، والسبعة مطلوبون

## 1) ملف أو نص

الاشتراك لازم يكون `active`.

### حفظ

`POST /api/coaches/:subscriptionId/nutrition-file`

`Content-Type: multipart/form-data`

أرسلوا **واحداً فقط**:

- ملف في الحقل `nutritionFile`، أو
- نص في الحقل `nutritionText`

الملف المقبول صورة أو PDF. الحد الافتراضي 10 ميجا. الأنواع غير المدعومة ترجع 400 برسالة `Unsupported file type or unexpected file field.`

لو الملف والنص الاتنين فاضيين:

```json
{ "status": "error", "message": "Send either a nutrition file or nutrition text" }
```

الرد عند النجاح لا يرجع المسار. اعملوا GET بعده.

```json
{ "status": "success", "message": "Nutrition file added successfully" }
```

اللاعب يوصل له إشعار `nutrition_added` أو `nutrition_updated`.

### قراءة

`GET /api/coaches/:subscriptionId/nutrition`

للكوتش صاحب الاشتراك أو اللاعب.

```json
{
  "status": "success",
  "message": "Retrieved nutrition successfully",
  "data": {
    "nutritionFile": "/images/coaches/1710000000000-123.pdf",
    "nutritionText": null
  }
}
```

اعرضوا واحداً فقط. لو `nutritionFile` موجود، افتحوه على نفس أصل السيرفر: `https://<host>/images/coaches/...`. لو `nutritionText` موجود، اعرضوا النص. لو الاتنين `null`، الحالة فاضية.

## 2) مكتبة الأكل والوجبات

الكوتش يشوف أصناف المكتبة النشطة، وأصنافه الخاصة. لا يقدر يعدّل أو يحذف أصناف المكتبة. الحذف لأصنافه فقط، وبعد إخراجها من الوجبات والخطط.

### الأكل

`GET /api/food-items?q=&mealType=&tags=&page=&limit=`

`POST /api/food-items`

`PUT /api/food-items/:id`

`DELETE /api/food-items/:id`

جسم الإنشاء:

```json
{
  "nameAr": "صدر فراخ مشوي",
  "nameEn": "Chicken breast, grilled",
  "mealType": "lunch",
  "nutritionPer100g": { "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6 },
  "defaultServingGrams": 150,
  "tags": ["high_protein"],
  "image": "https://...",
  "isActive": true
}
```

`nameAr` و`mealType` و`nutritionPer100g` و`defaultServingGrams` مطلوبون عند الإنشاء. `nameEn` و`tags` و`image` اختياريون.

رد الصنف:

```json
{
  "id": "…",
  "seedId": "food_002",
  "source": "library",
  "userId": null,
  "nameAr": "صدر فراخ مشوي",
  "nameEn": "Chicken breast, grilled",
  "mealType": "lunch",
  "nutritionPer100g": { "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6 },
  "defaultServingGrams": 150,
  "tags": ["high_protein"],
  "isActive": true,
  "image": "https://..."
}
```

`source` يكون `library` أو `coach`. أصناف الكوتش يرجع فيها `userId`.

### الوجبات

`GET /api/meal-templates?q=&mealType=&goal=&page=&limit=`

`POST /api/meal-templates`

`PUT /api/meal-templates/:id`

`DELETE /api/meal-templates/:id`

```json
{
  "name": "غداء دايت",
  "description": "",
  "image": null,
  "imageSource": null,
  "mealType": "lunch",
  "goal": "cutting",
  "coachNote": "",
  "ingredients": [
    { "foodId": "<food id>", "quantityGrams": 150 }
  ],
  "isActive": true
}
```

لازم مكوّن واحد على الأقل. `quantityGrams` أكبر من صفر. السيرفر يحسب سعرات كل مكّون والإجمالي.

رد الوجبة فيه `ingredients[]` وبداخل كل صف: `foodId` و`quantityGrams` و`food` و`calories` و`protein` و`carbs` و`fat`، بالإضافة إلى `totals`.

## 3) الخطة الأسبوعية

الخطة ملك الكوتش. اللاعب لا يشوفها إلا بعد التعيين، والنسخة المعيّنة لا تتغير لو الكوتش عدّل الخطة الأصلية. التحديث عند اللاعب يحصل بإعادة التعيين.

### إنشاء

`POST /api/nutrition-plans`

الخطة تتحفظ `status: "draft"`.

```json
{
  "name": "أسبوع تخسيس",
  "goal": "cutting",
  "targetCalories": 1800,
  "isTemplate": false,
  "days": [
    {
      "dayNumber": 1,
      "note": "",
      "meals": [
        {
          "mealTemplateId": "<meal id>",
          "name": "فطار",
          "mealType": "breakfast",
          "description": "",
          "coachNote": "",
          "image": null
        },
        {
          "name": "غداء حر",
          "mealType": "lunch",
          "items": [
            { "foodId": "<food id>", "quantityGrams": 150 },
            { "foodId": "<food id>", "quantityGrams": 200 }
          ]
        }
      ]
    }
  ]
}
```

قواعد الجسم:

- `name` و`goal` و`days` مطلوبون.
- `days` طوله 7، وفيه `dayNumber` من 1 إلى 7 من غير تكرار أو غياب.
- `targetCalories` اختياري، ولو اتبعت يكون رقم ≥ 0.
- `isTemplate: true` يعني الخطة نموذج يعاد استخدامه. التعيين لا يغيّر حالتها إلى `assigned`.
- كل وجبة لازم يكون لها اسم، ونوع وجبة، وصنف واحد على الأقل.
- لو بعتوا `mealTemplateId` من غير `items`، السيرفر ينسخ مكّونات الوجبة الجاهزة وأوزانها.
- لو بعتوا `items`، هي اللي تتحسب، حتى لو فيه `mealTemplateId`.
- `foodId` لازم يكون صنف مكتبة نشط أو صنفاً خاصاً بهذا الكوتش.
- لا ترسلوا سعرات الصنف. السيرفر يحسبها من `nutritionPer100g` والوزن.

اليوم الفاضي مسموح: `meals: []`.

### باقي عمليات الخطة

| العملية | الطلب |
|---|---|
| قائمة خططي | `GET /api/nutrition-plans?isTemplate=true\|false&page=&limit=` |
| خطة واحدة | `GET /api/nutrition-plans/:id` |
| تعديل | `PUT /api/nutrition-plans/:id` بنفس جسم الإنشاء |
| نسخ كمسودة جديدة | `POST /api/nutrition-plans/:id/duplicate` والجسم الاختياري `{ "name": "اسم النسخة" }` |
| حذف | `DELETE /api/nutrition-plans/:id` |

الحذف لا يحذف النسخة التي سبق تعيينها للاعب.

رد الخطة:

```json
{
  "id": "…",
  "coachId": "…",
  "name": "أسبوع تخسيس",
  "goal": "cutting",
  "targetCalories": 1800,
  "isTemplate": false,
  "status": "draft",
  "days": [],
  "totals": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "createdAt": "…",
  "updatedAt": "…"
}
```

`status` يكون `draft` أو `assigned`.

كل يوم في الرد:

```json
{
  "dayNumber": 1,
  "note": "",
  "meals": [
    {
      "mealTemplateId": "…",
      "name": "فطار",
      "description": "",
      "mealType": "breakfast",
      "coachNote": "",
      "image": null,
      "items": [
        {
          "foodId": "…",
          "nameAr": "بيض مسلوق",
          "nameEn": "Boiled egg",
          "quantityGrams": 100,
          "calories": 155,
          "protein": 13,
          "carbs": 1.1,
          "fat": 11
        }
      ],
      "totals": { "calories": 155, "protein": 13, "carbs": 1.1, "fat": 11 }
    }
  ],
  "totals": { "calories": 155, "protein": 13, "carbs": 1.1, "fat": 11 }
}
```

اعرضوا `totals` الراجعة من السيرفر، على مستوى الصنف والوجبة واليوم والخطة.

### تعيين الخطة على لاعب

`POST /api/subscriptions/:subscriptionId/nutrition-plan`

```json
{ "planId": "<plan id>" }
```

الشروط:

- الاشتراك موجود وغير محذوف
- حالته `active`
- `coachId` هو الكوتش المسجّل
- الخطة ملك نفس الكوتش

التعيين ينسخ اسم الخطة والهدف والأيام والإجماليات على الاشتراك. تعديل الخطة الأصلية بعد ذلك لا يغيّر ما يراه اللاعب إلا بإعادة التعيين.

لو الخطة ليست نموذجاً، حالتها تصبح `assigned`.

اللاعب يوصل له إشعار `nutrition_plan_assigned` أو `nutrition_plan_updated`.

### قراءة الخطة المعيّنة

`GET /api/subscriptions/:subscriptionId/nutrition-plan`

للكوتش أو اللاعب صاحب الاشتراك.

`data` تكون `null` لو لم تُعيَّن خطة. غير كده:

```json
{
  "id": "…",
  "subscriptionId": "…",
  "coachId": "…",
  "athleteId": "…",
  "sourcePlanId": "…",
  "name": "أسبوع تخسيس",
  "goal": "cutting",
  "targetCalories": 1800,
  "days": [],
  "totals": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "assignedAt": "…"
}
```

شكل `days` هنا نفس شكل أيام الخطة أعلاه.

## شاشة الكوتش المقترحة

1. على الاشتراك، أبقوا الاختيار الحالي: **رفع ملف** أو **كتابة نص**.
2. أضيفوا اختياراً ثالثاً: **خطة أسبوعية**.
3. الخطة الأسبوعية: اختاروا هدفاً، ثم 7 أيام، ثم أضيفوا وجبة جاهزة أو أصنافاً بالوزن.
4. احفظوا الخطة، ثم عيّنوها على اشتراك اللاعب.
5. في شاشة اللاعب اعرضوا الثلاثة لو موجودين: الملف، النص، والخطة الأسبوعية. لا تخفوا واحداً لأن الآخر موجود.
