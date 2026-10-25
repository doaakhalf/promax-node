# للفرونت: History الأوزان ومقاسات الجسم

الرياضي يقدر يضيف وزن و/أو مقاسات جسم في أي وقت. كل إضافة بتتسجل كـ entry بتاريخ **النهاردة من السيرفر**، والبروفايل الأساسي دايماً شايل أحدث قيم، وكل اللي فات بيبقى history يقدر يعرضه ويعدّله ويحذفه.

كل الطلبات زي ما هي:

```http
X-Api-Key: <CLIENT_API_KEY>
Authorization: Bearer <access_token>
```

---

## القواعد المهمة

1. **التاريخ من السيرفر بس:** متبعتوش أي تاريخ في الإضافة — اللي تبعتوه هيتسجل بتاريخ النهاردة تلقائياً، وأي تاريخ يتبعت في الـ body هيتم تجاهله.
2. **الحالي من `current`:** أحدث وزن/مقاسات بيرجعوا جاهزين في حقل `current` داخل رد `GET /api/athlete/progress` نفسه (ونفس القيم موجودة في `GET /api/athlete/my-profile`) — متستنتجوش الحالي من آخر entry في الـ history.
3. **القديم محفوظ دايماً:** وزن التسجيل الأصلي وكل القيم السابقة موجودين في الـ history. أول entry لأي رياضي قديم هي وزنه بتاريخ تسجيله.
4. **الوحدات ثابتة:** الوزن `kg`، وكل المقاسات `cm`.
5. **إضافة جزئية عادي:** تقدر تبعت وزن بس، أو مقاس واحد بس، أو أي مجموعة — اللي مش مبعوت بيحتفظ بقيمته الحالية في البروفايل.
6. **قياس واحد لكل يوم:** لو ضاف وزن/مقاس تاني في نفس اليوم، الـ entry بتاع النهاردة بيتعمل له **replace** (تحديث لنفس السجل) مش entry جديد. الحقول المبعوتة بس هي اللي بتتغيّر؛ الباقي في نفس الـ entry بيفضل زي ما هو.

---

## المقاسات المتاحة

كلها اختيارية، وكلها أرقام بين `10` و `300`:

| الحقل | المعنى |
|-------|--------|
| `chest` | الصدر |
| `waist` | الوسط |
| `hips` | الأرداف |
| `armRight` | الذراع اليمين |
| `armLeft` | الذراع الشمال |
| `thighRight` | الفخذ اليمين |
| `thighLeft` | الفخذ الشمال |
| `calf` | السمانة |
| `neck` | الرقبة |
| `shoulders` | الأكتاف |

الوزن `weight` رقم بين `20` و `500`.

---

## إضافة قياس جديد

```http
POST /api/athlete/progress
```

```json
{
  "weight": 84.5,
  "measurements": { "waist": 81, "chest": 99 },
  "note": "بعد أسبوعين دايت"
}
```

- لازم وزن **أو** مقاس واحد على الأقل، وإلا `422`.
- `note` اختياري (حد أقصى 500 حرف).

الرد `201` لو entry جديد، أو `200` لو حصل replace لنفس يوم النهاردة:

```json
{
  "status": "success",
  "message": "Progress recorded successfully",
  "data": {
    "id": "6714c0e2a1b2c3d4e5f60720",
    "weight": 84.5,
    "measurements": {
      "chest": 99, "waist": 81, "hips": null, "armRight": null, "armLeft": null,
      "thighRight": null, "thighLeft": null, "calf": null, "neck": null, "shoulders": null
    },
    "note": "بعد أسبوعين دايت",
    "recordedAt": "2026-10-20T09:30:00.000Z",
    "date": "2026-10-20",
    "createdAt": "2026-10-20T09:30:00.000Z",
    "updatedAt": "2026-10-20T09:30:00.000Z"
  },
  "current": {
    "weight": 84.5,
    "measurements": {
      "chest": 99, "waist": 81, "hips": null, "armRight": null, "armLeft": null,
      "thighRight": null, "thighLeft": null, "calf": null, "neck": null, "shoulders": null
    }
  }
}
```

- `data` هي الـ entry اللي اتسجلت دلوقتي (المقاسات اللي متبعتتش فيها `null`).
- `current` هي القيم الحالية بعد الدمج — نفس اللي هتلاقوها في `my-profile`. الحقول اللي الرياضي لسه مسجلهاش قبل كده بترجع `null`.

---

## عرض الـ history

```http
GET /api/athlete/progress?page=1&limit=20
```

فلترة اختيارية بالتاريخ: `?from=2026-01-01&to=2026-10-20` (يوم `to` شامل كله).

الرد `200`:

```json
{
  "status": "success",
  "message": "Progress history retrieved successfully",
  "current": {
    "weight": 84.5,
    "measurements": {
      "chest": 99, "waist": 81, "hips": null, "armRight": null, "armLeft": null,
      "thighRight": null, "thighLeft": null, "calf": null, "neck": null, "shoulders": null
    }
  },
  "data": [
    {
      "id": "6714c0e2a1b2c3d4e5f60720",
      "weight": 84.5,
      "measurements": { "chest": 99, "waist": 81, "hips": null, "armRight": null, "armLeft": null, "thighRight": null, "thighLeft": null, "calf": null, "neck": null, "shoulders": null },
      "note": null,
      "recordedAt": "2026-10-20T09:30:00.000Z",
      "date": "2026-10-20"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

- **`current` هو الحالي المعروض في الشاشة** (وزن + مقاسات من البروفايل): مع Axios اقرأوه `response.data.current.weight` و `response.data.current.measurements`. كده شاشة الوزن/المقاسات محتاجة الـ API دي بس، ومش لازم تنادوا `my-profile`.
- **متستنتجوش الحالي من `data[0].weight` أبداً:** أحدث entry ممكن تكون مقاسات بس ووزنها `null`، رغم إن الوزن الحالي موجود في `current.weight`.
- `data` مترتبة من الأحدث للأقدم. للرسم البياني اعكسوا الترتيب عندكم واستخدموا `date` للمحور و`weight`/أي مقاس للقيم (تجاهلوا الـ `null`).
- الـ entry الواحدة ممكن يكون فيها وزن بس أو مقاسات بس — اعرضوا اللي موجود بس.

---

## تعديل قياس

```http
PUT /api/athlete/progress/:entryId
```

ابعتوا اللي عايزين تغيّروه بس: `{ "weight": 84 }` أو `{ "measurements": { "waist": 80 } }` أو `{ "note": "..." }`. بعت `null` لحقل بيمسح قيمته من الـ entry دي بس.

- تعديل entry قديمة **مش** بيغيّر القيم الحالية في البروفايل (الحالي بييجي دايماً من أحدث قيم)، والرد فيه `current` بعد التعديل للتأكيد.
- ممنوع تعدّي الـ entry لدرجة تبقى فاضية تماماً (من غير وزن ولا أي مقاس) — هترجع `422`.

## حذف قياس

```http
DELETE /api/athlete/progress/:entryId
```

- الرد فيه `current`: لو حذفتوا أحدث entry، الحالي بيرجع تلقائياً للقيم اللي قبلها.
- حذف/تعديل entry مش بتاعة الرياضي نفسه بيرجع `404`.

---

## الحالي في البروفايل

`GET /api/athlete/my-profile` بقى فيه `measurements` جنب `weight` زي ما هو:

```json
{
  "weight": 84.5,
  "height": 180,
  "measurements": {
    "chest": 99, "waist": 81, "hips": null, "armRight": null, "armLeft": null,
    "thighRight": null, "thighLeft": null, "calf": null, "neck": null, "shoulders": null
  }
}
```

---

## الأخطاء

| الحالة | المعنى |
|--------|--------|
| `422` + `errors` لكل حقل | مفيش وزن ولا أي مقاس، أو قيمة بره النطاق (وزن 20–500، مقاس 10–300) |
| `400` | `entryId` مش صالح، أو تاريخ `from`/`to` مش صالح |
| `404` | الـ entry مش موجودة أو مش بتاعة الرياضي |
| `403` | الحساب مش رياضي |

كمان تعديل الوزن من تعديل البروفايل القديم (`PUT /api/athlete/edit`) بقى بيتحفظ في نفس الـ history تلقائياً قبل ما البروفايل يتحدّث، فالشاشتين ماشيين على مصدر واحد.
