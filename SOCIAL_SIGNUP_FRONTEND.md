# Social signup (Mobile frontend)

حساب جديد (كوتش أو رياضي) يتسجل من **Google** أو **Apple** فقط. شاشة الإيميل والباسورد للتسجيل تتشال. تسجيل الدخول بالإيميل يفضل للحسابات القديمة.

كل الطلبات:

```http
X-Api-Key: <CLIENT_API_KEY>
```

`/complete` مع ملفات يبقى `multipart/form-data`. من غير ملفات، `application/json` كفاية. متبعتش `Content-Type` يدوي مع `FormData`.

---

## الشاشات

1. اختيار الدور: كوتش أو رياضي.
2. زرار Google وزرار Apple. مفيش فورم إيميل/باسورد للتسجيل.
3. لو الحساب موجود: احفظ التوكن وادخل الهوم حسب `user.role`.
4. لو حساب جديد: شاشة إكمال البيانات، والاسم والإيميل والصورة متعبّين من الرد.
5. الكوتش بعد النجاح: شاشة انتظار الموافقة (`status: "pending"`). الرياضي يدخل الهوم.

متحفظيش session بعد الخطوة الأولى لو `needsProfileCompletion === true`. مفيش access token لسه.

التوكن المؤقت بيخلص في حوالي **15 دقيقة**. لو رجع `401`، ارجعي المستخدم يختار Google أو Apple من الأول. متستخدميش التوكن القديم.

---

## 1) Google

```http
POST /api/auth/google
```

```json
{
  "idToken": "<Google ID token>",
  "user_type": "coach"
}
```

| الحقل | مطلوب | ملاحظة |
|--------|--------|--------|
| `idToken` | نعم | ID token من الـ SDK، مش access token |
| `user_type` | للكوتش نعم | `"coach"` أو `"athlete"`. لو مش مبعوت، الحساب الجديد يتسجل رياضي |

### حساب موجود — `200`

```json
{
  "needsProfileCompletion": false,
  "token": "<access JWT>",
  "refreshToken": "<refresh JWT>",
  "expiresIn": 3600,
  "token_type": "Bearer",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "coach",
    "profileImage": "https://...",
    "status": "pending",
    "slug": "...",
    "shareProfileUrl": "..."
  }
}
```

احفظي `token` و `refreshToken` زي اللوجين العادي. التوجيه حسب `user.role` مش حسب `user_type` اللي اتبعت. كوتش `pending` يروح شاشة الانتظار.

### حساب جديد — `200`

```json
{
  "needsProfileCompletion": true,
  "googleSignupToken": "<short-lived>",
  "email": "user@gmail.com",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "profileImage": "https://lh3.googleusercontent.com/...",
  "userType": "coach"
}
```

- الإيميل read-only.
- عبّي الاسم والصورة في الفورم.
- احتفظي بـ `googleSignupToken` و **نفس** `idToken` لحد ما `/complete` ينجح.
- افتحي فورم الكوتش أو الرياضي حسب `userType`.

### إكمال الحساب

```http
POST /api/auth/google/complete
```

لازم نفس `idToken`. الإيميل والاسم والصورة مصدرهم التوكن. متبعتيش `email`. ابعتي `firstName` / `lastName` بس لو رجعوا فاضيين. رفع `profileImage` يستبدل صورة جوجل.

---

## 2) Apple

```http
POST /api/auth/apple
```

```json
{
  "identityToken": "<Apple identity token>",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "user_type": "coach"
}
```

آبل تبعت الاسم **أول مرة بس**. ابعتيه في النداء ده. آبل مفيهاش صورة، فالرد فيه `"profileImage": null`.

Hide My Email بيرجع إيميل زي `abc@privaterelay.appleid.com`. ده إيميل الحساب. متطلبيش من المستخدم يغيّره.

### حساب جديد — `200`

```json
{
  "needsProfileCompletion": true,
  "appleSignupToken": "<short-lived>",
  "email": "abc@privaterelay.appleid.com",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "profileImage": null,
  "userType": "coach"
}
```

لو `firstName` أو `lastName` رجعوا `null`، الفورم يطلبهم.

### إكمال الحساب

```http
POST /api/auth/apple/complete
```

ابعتي `appleSignupToken` ونفس `identityToken`. باقي الحقول زي جوجل.

---

## فورم الرياضي

| الحقل | مطلوب |
|--------|--------|
| `gender` | `male` \| `female` \| `other` |
| `phoneNumber` | موبايل مصري: `01` ثم `0` أو `1` أو `2` أو `5` ثم 8 أرقام |
| `dateOfBirth` | `YYYY-MM-DD` |
| `weight` | رقم |
| `height` | رقم |
| `trainingFrequency` | `"1"` … `"7"` |
| `goals` | لا |
| `injuries` | لا |
| `profileImage` | لا، ملف |
| `inbodyFile` | لا، ملف |

نجاح `201`: `needsProfileCompletion: false`، توكنات، و `userData` بروفايل الرياضي. الحالة `active`. ادخلي الهوم.

---

## فورم الكوتش

| الحقل | مطلوب |
|--------|--------|
| `gender` | `male` \| `female` \| `other` |
| `phoneNumber` | موبايل مصري |
| `type` | `normal` \| `gym` |
| `monthlyPriceEgp` | رقم ≥ 0 |
| `instapayLink` أو `walletNumber` | واحد منهم على الأقل. اللينك: `https://ipn.eg/S/.../instapay/...`. المحفظة موبايل مصري |
| `sport` | نعم |
| `headline` | نعم |
| `motivation` | نعم |
| `trainingExperience` | نعم |
| `yearOfExperience` | رقم ≥ 0 |
| `firstName` / `lastName` | بس لو المزود مرجعهمش |
| `introduction` | لا |
| `videoUrl` | لا |
| `profileImage` | لا، ملف |
| `certificates` | لا |
| `achievements` | لا |
| `galleryImages` | لا |

الشهادات والإنجازات والمعرض بنفس شكل التسجيل القديم (JSON + ملفات).

نجاح `201`:

```json
{
  "message": "Coach registered successfully. Awaiting admin approval.",
  "needsProfileCompletion": false,
  "token": "<access JWT>",
  "refreshToken": "<refresh JWT>",
  "expiresIn": 3600,
  "token_type": "Bearer",
  "userData": {
    "status": "pending",
    "role": "coach"
  }
}
```

احفظي التوكنات وافتحي شاشة انتظار الموافقة. متدخليش الكوتش للهوم قبل ما `status` تبقى `active`.

### مثال multipart للكوتش

```js
const form = new FormData();
form.append("googleSignupToken", googleSignupToken);
form.append("idToken", idToken);
form.append("gender", "male");
form.append("phoneNumber", "01012345678");
form.append("type", "normal");
form.append("monthlyPriceEgp", "1500");
form.append("walletNumber", "01012345678");
form.append("sport", "Football");
form.append("headline", "Strength coach");
form.append("motivation", "Build consistent athletes");
form.append("trainingExperience", "Club and private sessions");
form.append("yearOfExperience", "6");

await fetch(`${API_BASE}/api/auth/google/complete`, {
  method: "POST",
  headers: { "X-Api-Key": CLIENT_API_KEY },
  body: form,
});
```

لآبل استبدلي `googleSignupToken` بـ `appleSignupToken` و `idToken` بـ `identityToken`، والمسار `/api/auth/apple/complete`.

---

## أخطاء

| الحالة | المعنى | الواجهة |
|--------|--------|---------|
| `422` | حقل ناقص أو الإيميل/الموبايل موجود | اعرضي `errors` جنب الحقول |
| `401` | التوكن خلص أو مش مطابق | ارجعي لشاشة Google / Apple |
| `403` | الحساب مش كوتش ولا رياضي، أو حد ضرب `/register` | رسالة إن التسجيل من Google أو Apple |
| `429` | طلبات كتير | جرّب بعدين |

```json
{
  "message": "Validation error",
  "errors": {
    "phoneNumber": "Phone number already exists"
  }
}
```

`POST /api/register` دايمًا:

```json
{
  "status": "error",
  "message": "Registration is only available with Google or Apple"
}
```

لوجين الإيميل لحساب مربوط بجوجل:

```json
{
  "status": "error",
  "message": "This account uses Google Sign-In. Please continue with Gmail."
}
```

ولآبل: `"This account uses Apple Sign-In. Please continue with Apple."`

تجديد التوكن زي الأول: `POST /api/user/refresh`.
