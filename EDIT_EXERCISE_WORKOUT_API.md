# Edit Exercise & Workout API (Coach Frontend)

Base path: `/api`  
Auth: `Authorization: Bearer <access_token>` on all routes  
Role: Coach

These are **full PUT** updates: send the complete form state (all required fields), even if a field did not change.  
Image on exercise update is the only optional field.

---

## 1. Edit Exercise

### Recommended UI flow

1. Load exercise from list (`GET /api/exercise`) — keep the selected item in state (no single-get endpoint yet).
2. Fill edit form with current values.
3. On save → `PUT /api/exercise/:id` with **multipart/form-data**.
4. Do **not** allow edit when `source === "exercisedb"` (API will reject).

### `PUT /api/exercise/:id`

**Content-Type:** `multipart/form-data`  
**Field name for image:** `image` (file)

| Field | Required | Notes |
|-------|----------|--------|
| `nameEn` | Yes | Non-empty string |
| `nameAr` | Yes | Non-empty string |
| `type` | Yes | Non-empty string |
| `targetBodyParts` | Yes | JSON array string, e.g. `["chest","back"]`, or array if client sends JSON parts |
| `descriptionEn` | No | Empty → stored as `null` |
| `descriptionAr` | No | Empty → stored as `null` |
| `videoUrl` | No | Empty → stored as `null` |
| `image` | No | Omit to **keep existing image**. Send new file only when user picks a new one |

**Example (FormData)**

```js
const form = new FormData();
form.append("nameEn", "Bench Press");
form.append("nameAr", "بنش برس");
form.append("type", "strength");
form.append("targetBodyParts", JSON.stringify(["chest", "triceps"]));
form.append("descriptionEn", "Flat bench");
form.append("descriptionAr", "بنش مستوي");
form.append("videoUrl", "https://...");
// only if user selected a new image:
if (newImageFile) form.append("image", newImageFile);

await api.put(`/api/exercise/${exerciseId}`, form);
// Do NOT set Content-Type manually; let the client set multipart boundary
```

**Success `200`**

```json
{
  "message": "Exercise updated successfully",
  "data": {
    "_id": "...",
    "userId": "...",
    "nameEn": "Bench Press",
    "nameAr": "بنش برس",
    "type": "strength",
    "targetBodyParts": ["chest", "triceps"],
    "descriptionEn": "Flat bench",
    "descriptionAr": "بنش مستوي",
    "image": "/images/exercises/....jpg",
    "videoUrl": "https://...",
    "source": "coachcreator"
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `422` | Validation failed (`errors` object per field) |
| `404` | Exercise not found |
| `403` | Not the owner |
| `400` | Exercise from ExerciseDB (`source: "exercisedb"`) — not editable |

---

## 2. Edit Workout (Gym)

### Recommended UI flow

1. `GET /api/workout/:id` → fill form (`name`, `description`, exercises/sets).
2. User edits freely (add/remove/reorder sets).
3. On save → `PUT /api/workout/:id` with the **full `sets` array** (backend replaces all old sets/details).

> Important: edit is a **replace**, not a patch of individual set IDs. Rebuild `sets` from the form every time.

### `GET /api/workout/:id` (preload edit screen)

**Success `200`**

```json
{
  "message": "Workout retrieved successfully",
  "data": {
    "workoutId": "...",
    "workout": {
      "_id": "...",
      "name": "Push Day",
      "description": "...",
      "workoutType": "gym"
    },
    "exercises": [
      {
        "exercise": { "_id": "...", "nameEn": "...", "nameAr": "..." },
        "order": 1,
        "notes": "...",
        "sets": [
          {
            "gymWorkoutSetId": "...",
            "order": 1,
            "notes": "...",
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

Map GET → PUT body like this:

```js
const sets = data.exercises.flatMap((ex) =>
  ex.sets.map((s) => {
    const d = s.setDetails?.[0] || {};
    return {
      exerciseId: ex.exercise._id,
      order: s.order,
      notes: s.notes,
      durationType: d.durationType,      // "reps" | "time"
      durationValue: d.durationValue,  // required when durationType === "time"
      sets: d.sets,                    // required when durationType === "reps"
      reps: d.reps,                    // required when durationType === "reps"
      rest: d.restSeconds,             // maps to restSeconds on backend
      weight: d.weight,                // required when weightType is custom (default)
    };
  })
);
```

### `PUT /api/workout/:id`

**Content-Type:** `multipart/form-data` or form fields (route uses `uploader.none()` — no file).  
Same shape as create.

| Field | Required | Notes |
|-------|----------|--------|
| `name` | Recommended | Workout title |
| `description` | No | |
| `sets` | Yes | Non-empty array. If sending multipart, send as **JSON string** |
| `confirmAssignedEdit` | Only on confirm retry | `"true"` after user accepts the 409 warning |

**Each item in `sets`**

| Field | Required | Notes |
|-------|----------|--------|
| `exerciseId` | Yes | ObjectId of exercise |
| `order` | Yes | Sort order (1-based recommended) |
| `notes` | No | |
| `durationType` | Yes | `"reps"` or `"time"` |
| `durationValue` | If `time` | Number/string |
| `sets` | If `reps` | Number of sets |
| `reps` | If `reps` | Reps per set |
| `rest` | No | Rest seconds (default 30) |
| `weight` | Usually yes | Required when weight type is custom (default) |

### Assigned athletes confirmation (required UX)

If this workout is assigned to athletes who have an **active subscription** with the coach, the first save is blocked until the coach confirms.

1. Send `PUT` **without** `confirmAssignedEdit`.
2. If response is `200` → done (no active impact).
3. If response is `409` with `needsConfirmation: true` → show a confirm dialog listing `affectedAthletes`.
4. On **OK** → resend the **same** body + `confirmAssignedEdit: "true"`.
5. On **Cancel** → do not call the API again.

**409 response**

```json
{
  "message": "هذا التمرين معيّن لرياضيين لديهم اشتراك نشط. أكّد للمتابعة.",
  "code": "WORKOUT_ASSIGNED_ACTIVE",
  "needsConfirmation": true,
  "affectedAthletes": [
    { "id": "...", "name": "Ahmed Ali", "email": "a@example.com" }
  ],
  "assignmentCount": 3
}
```

**Example**

```js
const form = new FormData();
form.append("name", "Push Day");
form.append("description", "Updated plan");
form.append(
  "sets",
  JSON.stringify([
    {
      exerciseId: "69fb975ac2273b9783ef4019",
      order: 1,
      notes: "Slow eccentric",
      durationType: "reps",
      sets: 3,
      reps: 12,
      rest: 60,
      weight: 20
    },
    {
      exerciseId: "69fb975ac2273b9783ef4020",
      order: 2,
      notes: null,
      durationType: "time",
      durationValue: 45,
      rest: 30,
      weight: 0
    }
  ])
);

async function saveWorkout(workoutId, form, { confirmed = false } = {}) {
  if (confirmed) form.append("confirmAssignedEdit", "true");

  const res = await api.put(`/api/workout/${workoutId}`, form);
  if (res.status === 409 && res.data?.needsConfirmation) {
    const ok = await showConfirmDialog(res.data.affectedAthletes);
    if (!ok) return;
    return saveWorkout(workoutId, form, { confirmed: true });
  }
  return res;
}
```

**Success `200`**

```json
{
  "message": "Workout updated successfully",
  "data": {
    "workout": { "_id": "...", "name": "Push Day", "description": "Updated plan" },
    "gymWorkoutSets": [ /* newly created sets */ ],
    "setDetails": [ /* newly created details */ ]
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `404` | Coach profile missing, or workout not found / not owned |
| `400` | `sets` missing, empty, or invalid JSON |
| `409` | Assigned to athletes with active subscriptions; needs `confirmAssignedEdit` |
| `500` | DB / validation errors (e.g. missing reps when `durationType` is `reps`) |

---

## Quick checklist for frontend

**Exercise edit**
- [ ] PUT full fields every save
- [ ] `targetBodyParts` always sent (JSON string array)
- [ ] Image only if changed
- [ ] Block edit UI for `source === "exercisedb"`

**Workout edit**
- [ ] Prefill from `GET /api/workout/:id`
- [ ] Rebuild full `sets` array on save
- [ ] Field `rest` in body → backend `restSeconds`
- [ ] Expect old set IDs to change after update (replace flow)
- [ ] Handle `409` + `needsConfirmation`: dialog → retry with `confirmAssignedEdit=true`
