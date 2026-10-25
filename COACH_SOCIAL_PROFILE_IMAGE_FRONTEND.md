# صورة الكوتش في التسجيل بجوجل / أبل

تغيير واحد للكوتش فقط: السيرفر **مش بياخد** صورة الملف الشخصي من جوجل أو أبل. الكوتش لازم يرفع صورته بنفسه، والرفع **إجباري** على `/complete`.

الرياضي زي ما هو (صورة جوجل لسه ممكن تتعمل prefill، والرفع اختياري).

كل الطلبات زي ما هي:

```http
X-Api-Key: <CLIENT_API_KEY>
```

`/complete` مع الصورة يبقى `multipart/form-data`. اسم الحقل: `profileImage`.

---

## اللي اتغيّر

| قبل | بعد (كوتش) |
|-----|-------------|
| جوجل ممكن يرجّع رابط صورة ويعمله prefill | `profileImage` في رد step 1 دايمًا `null` |
| رفع الصورة إجباري بس لو جوجل مابعتش صورة | رفع الصورة **إجباري دائمًا** |
| لو فيه صورة جوجل، الرفع كان اختياري | صورة جوجل/أبل **مش بتتخزن** أصلًا |

أبل أصلًا مابتبعتش صورة؛ السلوك بقا موحّد مع جوجل للكوتش.

---

## Step 1 — رد حساب جديد (كوتش)

```http
POST /api/auth/google
POST /api/auth/apple
```

مثال رد (كوتش):

```json
{
  "needsProfileCompletion": true,
  "googleSignupToken": "<short-lived>",
  "email": "user@gmail.com",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "profileImage": null,
  "userType": "coach",
  "requiredFields": ["profileImage"]
}
```

- `profileImage` للكوتش = `null` دايمًا (جوجل أو أبل).
- `requiredFields` فيه `"profileImage"` دايمًا للكوتش.
- متستخدميش صورة الـ SDK محليًا كـ prefill للكوتش.

---

## Step 2 — إكمال البروفايل

```http
POST /api/auth/google/complete
POST /api/auth/apple/complete
```

للكوتش لازم ملف:

| الحقل | مطلوب | ملاحظة |
|--------|--------|--------|
| `profileImage` | نعم | ملف صورة (multipart) |

من غير الملف السيرفر يرجع `422`:

```json
{
  "message": "Validation error",
  "errors": {
    "profileImage": "Profile image is required"
  }
}
```

باقي حقول فورم الكوتش زي ما هي في [SOCIAL_SIGNUP_FRONTEND.md](./SOCIAL_SIGNUP_FRONTEND.md).

---

## المطلوب في الفرونت (checklist)

1. شاشة إكمال بروفايل **الكوتش**: خانة رفع صورة ظاهرة وإجبارية قبل الـ submit.
2. ابعتي الصورة في FormData باسم `profileImage`.
3. متتعمّديش على `profileImage` من رد step 1 للكوتش (هتكون `null`).
4. لو `requiredFields` فيه `profileImage` → اعتبري الرفع ناقص ومتكمّليش غير بعد الاختيار.
5. الرياضي: مفيش تغيير (prefill من جوجل لو موجود، والرفع اختياري).
