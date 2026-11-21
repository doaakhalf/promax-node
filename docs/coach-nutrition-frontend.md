# تغذية الكوتش — دليل الفرونت

الكوتش يقدر يدي اللاعب التغذية بثلاث طرق مستقلة. لا تستبدلوا طريقة بطريقة.

| الطريقة | أين تتحفظ | ماذا تمسح |
|---|---|---|
| رفع ملف | `subscription.nutritionFile` | تمسح النص فقط |
| كتابة نص | `subscription.nutritionText` | تمسح الملف فقط |
| خطة أسبوعية | `NutritionAssignment` على نفس الاشتراك | لا تمسح الملف ولا النص |

حفظ الخطة الأسبوعية لا يمسح الملف أو النص. رفع ملف أو كتابة نص لا يمسح الخطة الأسبوعية.

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
- أيام الخطة: `dayNumber` من 1 إلى 7. الطلب فيه من يوم واحد إلى سبعة، والسبعة مش مطلوبين مع بعض.

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

الخطة تخص لاعب الاشتراك فقط. الكوتش ينشئها ويعدّلها على الاشتراك مباشرة، من غير خطة مستقلة ومن غير `planId`. مكتبة الأصناف والوجبات تفضل للاختيار منها.

### إنشاء

`POST /api/subscriptions/:subscriptionId/nutrition-plan`

يحفظ الأيام المرسلة فقط. لو الاشتراك فيه خطة قديمة، قائمة الأيام تتستبدل بالقائمة الجديدة.

```json
{
  "name": "أسبوع تخسيس",
  "goal": "cutting",
  "targetCalories": 1800,
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

يوم واحد يكفي. أقصى حاجة سبعة أيام في الطلب.

### تعديل

`PUT /api/subscriptions/:subscriptionId/nutrition-plan`

يبعت الأيام المطلوب تغييرها أو إضافتها فقط. اليوم الموجود يتستبدل، واليوم الجديد يتضاف، وباقي الأيام تفضل. إرسال يوم يستبدل وجبات ذلك اليوم كلها.

`name` و`goal` و`targetCalories` اختياريون في التعديل. لو ما اتبعتوش تفضل القيم الحالية. لو مفيش خطة على الاشتراك، التعديل يرجع 404.

قواعد الجسم:

- في الإنشاء، `name` و`goal` و`days` مطلوبون. في التعديل، `days` مطلوب و`name` و`goal` اختياريان.
- `days` من يوم واحد إلى سبعة. `dayNumber` من 1 إلى 7 من غير تكرار داخل الطلب.
- صفر أيام، أو أكثر من سبعة، أو رقم يوم خارج 1–7، يرجع 400.
- `targetCalories` اختياري، ولو اتبعت يكون رقم ≥ 0.
- كل وجبة لازم يكون لها اسم، ونوع وجبة، وصنف واحد على الأقل.
- لو بعتوا `mealTemplateId` من غير `items`، السيرفر ينسخ مكّونات الوجبة الجاهزة وأوزانها.
- لو بعتوا `items`، هي اللي تتحسب. لو قالب الوجبة بقى غير موجود أو غير نشط، الرابط يتشال والخطة تتحفظ من `items`.
- صنف جديد لازم يكون مكتبة نشطة أو صنفاً خاصاً بهذا الكوتش. صنف محفوظ أصلاً على خطة هذا الاشتراك يفضل مسموحاً لو المكتبة عطّلته.
- لا ترسلوا سعرات الصنف. السيرفر يحسبها من `nutritionPer100g` والوزن.

اليوم الفاضي مسموح: `meals: []`.

الشروط:

- الاشتراك موجود وغير محذوف
- حالته `active`
- `coachId` هو الكوتش المسجّل

أول حفظ يبعت إشعار `nutrition_plan_assigned`. أي حفظ بعد كده، إنشاء أو تعديل، يبعت `nutrition_plan_updated`.

### قراءة الخطة

`GET /api/subscriptions/:subscriptionId/nutrition-plan`

للكوتش أو اللاعب صاحب الاشتراك.

`data` تكون `null` لو لم تُحفظ خطة. غير كده:

```json
{
  "id": "…",
  "subscriptionId": "…",
  "coachId": "…",
  "athleteId": "…",
  "sourcePlanId": null,
  "name": "أسبوع تخسيس",
  "goal": "cutting",
  "targetCalories": 1800,
  "days": [
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
  ],
  "totals": { "calories": 155, "protein": 13, "carbs": 1.1, "fat": 11 },
  "assignedAt": "…"
}
```

اعرضوا `totals` الراجعة من السيرفر، على مستوى الصنف والوجبة واليوم والخطة. الأيام المحفوظة قد تكون أقل من سبعة.

## شاشة الكوتش المقترحة

1. على الاشتراك، أبقوا الاختيار الحالي: **رفع ملف** أو **كتابة نص**.
2. أضيفوا اختياراً ثالثاً: **خطة أسبوعية**، والحفظ يتم على نفس الاشتراك.
3. اختاروا هدفاً، ثم أضيفوا من يوم إلى سبعة. كل يوم فيه وجبة جاهزة أو أصناف بالوزن.
4. عند التعديل، ابعتوا اليوم المختار فقط عبر `PUT`. لا تعيدوا إرسال الأيام التي لم تتغير.
5. في شاشة اللاعب اعرضوا الثلاثة لو موجودين: الملف، النص، والخطة الأسبوعية. لا تخفوا واحداً لأن الآخر موجود.
