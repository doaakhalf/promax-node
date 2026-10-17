# Expired Workout Snapshot — تحديث الفرونت

لما الاشتراك يخلص (`expired`)، السيرفر بيعمل **snapshot** للوركأوت والتمارين جوه الكالندر. تعديلات المدرب بعد كده **مش** هتأثر على الاشتراكات القديمة — بشرط الفرونت يقرا التفاصيل بالـ `calendarId`.

---

## إيه اللي اتغيّر؟

| السياق | قبل | بعد |
|--------|-----|-----|
| تفاصيل وركأوت من كالندر **active** | `GET /api/workout/:id` | زي ما هو — مفيش تغيير |
| تفاصيل وركأوت من كالندر **expired** | `GET /api/workout/:id` (جراف حي) | لازم `?calendarId=...` عشان يرجع الـ snapshot المتجمد |
| شكل رد الكالندر (قائمة الأيام) | `workout: { id, name, description, type }` | نفس الشكل — مفيش تغيير في الـ UI |

---

## التغيير المطلوب (مهم)

في أي شاشة بتفتح تفاصيل وركأوت من تاريخ منتهي (رياضي أو كوتش):

```http
GET /api/workout/:workoutId?calendarId=<calendarId>
Authorization: Bearer <access_token>
```

### منين الـ `calendarId`؟

موجود في رد الكالندر المنتهي:

- رياضي: `GET /api/athletes/expired-workouts/:coachId` → `data[].calendar.calendarId`
- كوتش: `GET /api/coaches/athletes/:athleteId/expired-calendar` → نفس الحقل `calendarId` على الكالندر

والـ `workoutId` من اليوم: `weeks[].trainingDays[].workout.id`

### مثال

```http
GET /api/workout/66abc...?calendarId=66def...
```

شكل الرد **نفس** `getWorkout` الحالي:

```json
{
  "message": "Workout retrieved successfully",
  "data": {
    "workoutId": "...",
    "workout": {
      "_id": "...",
      "name": "...",
      "description": "...",
      "workoutType": "gym",
      "instructions": "..."
    },
    "exercises": [
      {
        "exercise": {
          "_id": "...",
          "nameAr": "...",
          "nameEn": "...",
          "image": "...",
          "videoUrl": "...",
          "type": "...",
          "targetBodyParts": []
        },
        "order": 0,
        "notes": null,
        "sets": [
          {
            "gymWorkoutSetId": "...",
            "order": 0,
            "notes": null,
            "setDetails": [
              {
                "id": "...",
                "durationType": "reps",
                "durationValue": null,
                "sets": 3,
                "reps": 12,
                "restSeconds": 60,
                "weightType": "custom",
                "weight": 20
              }
            ]
          }
        ]
      }
    ]
  }
}
```

مفيش parsing جديد — نفس الموديل اللي بتستخدموه في الوركأوت الـ active.

---

## سلوك السيرفر

| الطلب | النتيجة |
|-------|---------|
| `GET /workout/:id` من غير query | جراف حي (مناسب للـ active) |
| `GET /workout/:id?calendarId=X` والكالندر **expired** وفيه snapshot | يرجع الـ snapshot المتجمد |
| `GET /workout/:id?calendarId=X` والكالندر **active** أو مفيش snapshot | يرجع الجراف الحي زي الأول |

---

## Checklist للفرونت

1. شاشة تفاصيل وركأوت من **expired calendar** (رياضي): ابعتي `calendarId`.
2. شاشة تفاصيل وركأوت من **expired calendar** (كوتش): ابعتي `calendarId`.
3. شاشات الـ **active** workouts: سيبيها من غير `calendarId`.
4. مفيش تغيير على شكل قائمة الأيام في الكالندر.

لو نسيتِ `calendarId` على الشاشات المنتهية، المستخدم هيشوف تعديلات المدرب الجديدة بدل الخطة اللي كانت وقت الاشتراك.
