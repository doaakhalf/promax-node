# تأكيد تعديل Workout المعيّن (Frontend)

**Auth:** `Authorization: Bearer <token>`  
**Endpoint:** `PUT /api/workout/:id`  
**Content-Type:** `multipart/form-data` (زي create)

---

## الفكرة

لو الـ workout متعيّن لرياضيين عندهم **اشتراك نشط** مع المدرب:

1. أول حفظ → السيرفر **مش بيعدّل** ويرجع `409`
2. الفرونت يعرض Dialog بالرسالة + أسماء الرياضيين
3. لو المدرب وافق → نفس الـ request تاني مع `confirmAssignedEdit=true`
4. لو رفض → مفيش request تاني

لو مفيش رياضيين باشتراك نشط → أول `PUT` يرجع `200` مباشرة.

---

## Flow

```text
حفظ
  → PUT (بدون confirmAssignedEdit)
      → 200: تم التعديل
      → 409 + needsConfirmation:
            Dialog (message + affectedAthletes)
              → موافق → PUT بنفس الـ body + confirmAssignedEdit=true → 200
              → إلغاء → وقف
```

---

## Body (نفس create)

| Field | Required | Notes |
|-------|----------|--------|
| `name` | نعم (مستحسن) | |
| `description` | لا | |
| `sets` | نعم | JSON string array |
| `confirmAssignedEdit` | في الـ retry فقط | `"true"` |

مثال `sets`:

```json
[
  {
    "exerciseId": "...",
    "order": 1,
    "notes": "...",
    "durationType": "reps",
    "sets": 3,
    "reps": 12,
    "rest": 60,
    "weight": 20
  }
]
```

---

## Response: محتاج تأكيد `409`

```json
{
  "message": "هذا التمرين معيّن لرياضيين لديهم اشتراك نشط. أكّد للمتابعة.",
  "code": "WORKOUT_ASSIGNED_ACTIVE",
  "needsConfirmation": true,
  "affectedAthletes": [
    {
      "id": "64f...",
      "name": "أحمد علي",
      "email": "a@example.com"
    }
  ],
  "assignmentCount": 3
}
```

**Dialog suger:**
- Title / body: استخدم `message` من الـ response
- List: `affectedAthletes[].name`
- Primary: موافق / تأكيد
- Secondary: إلغاء

---

## Response: نجاح `200`

```json
{
  "message": "Workout updated successfully",
  "data": {
    "workout": { },
    "gymWorkoutSets": [ ],
    "setDetails": [ ]
  }
}
```

> بعد التعديل الـ set IDs بتتغير (replace كامل).

---

## مثال كود

```js
async function saveWorkout(workoutId, payload, { confirmed = false } = {}) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("description", payload.description ?? "");
  form.append("sets", JSON.stringify(payload.sets));
  if (confirmed) form.append("confirmAssignedEdit", "true");

  try {
    return await api.put(`/api/workout/${workoutId}`, form);
  } catch (err) {
    const data = err.response?.data;
    if (err.response?.status === 409 && data?.needsConfirmation) {
      const ok = await showConfirmDialog({
        message: data.message, // عربي من السيرفر
        athletes: data.affectedAthletes,
      });
      if (!ok) return null;
      return saveWorkout(workoutId, payload, { confirmed: true });
    }
    throw err;
  }
}
```

> لو الـ HTTP client بيرمي error على `409`، امسكها في `catch` زي فوق.  
> لو بيرجع response من غير throw، شيك على `status === 409`.

---

## Checklist فرونت

- [ ] أول save من غير `confirmAssignedEdit`
- [ ] Dialog على `409` + `needsConfirmation`
- [ ] عرض `message` + قائمة `affectedAthletes`
- [ ] موافق → نفس البيانات + `confirmAssignedEdit: "true"`
- [ ] إلغاء → لا تعيد الإرسال
- [ ] بعد النجاح: حدّث الـ UI (IDs جديدة للـ sets)
