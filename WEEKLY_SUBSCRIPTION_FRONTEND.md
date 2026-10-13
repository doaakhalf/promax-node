# الاشتراك الأسبوعي (Mobile)

الاشتراك الشهري زي ما هو. الأسبوع خيار إضافي، مرة واحدة بين الرياضي ونفس الكوتش.

كل الطلبات:

```http
X-Api-Key: <CLIENT_API_KEY>
Authorization: Bearer <access_token>
```

تفعيل الفلاج `application/json`. طلب الاشتراك `multipart/form-data` عشان صورة التحويل. متبعتش `Content-Type` يدوي مع `FormData`.

متحسبوش سعر الأسبوع في التطبيق. استخدمي `weeklyPrice` من الرد.

---

## قاعدة العرض

**الكوتش**

اعرضي السويتش من `GET /api/coaches/my-profile`. دخول الكوتش المتفعّل بيرجع يوزر مختصر من غير الحقول دي.

**الرياضي**

اعرضي زرار الأسبوع فقط لو الاتنين صح:

```text
weeklySubscriptionEnabled === true
weeklySubscriptionUsed === false
```

السعر الأسبوعي من `weeklyPrice`. السعر الشهري يفضل `price`.

اقرئي الحقول دي من `GET /api/coaches/with-subscription` والرياضي مسجّل. `GET /api/coaches` عام ومن غير توكن، فـ `weeklySubscriptionUsed` يفضل `false` ومش يتاخد منه قرار.

الأسبوع مرة واحدة مع نفس الكوتش. بعد ما يتستخدم، الشهري متاح لما مفيش اشتراك `active` أو `pending` مع الكوتش ده.

---

## 1) الكوتش يفعّل أو يوقف الأسبوع

```http
PUT /api/coaches/weekly-subscription
Content-Type: application/json
```

الدور: `coach`. مش جزء من تعديل البروفايل، ومش بيدخل مراجعة الأدمن.

```json
{ "weeklySubscriptionEnabled": true }
```

`weeklySubscriptionEnabled` لازم boolean حقيقي (`true` / `false`). النص `"true"` أو `1` يرجع `400`.

الرد `200`:

```json
{
  "status": "success",
  "message": "Weekly subscription status changed successfully",
  "data": {
    "weeklySubscriptionEnabled": true
  }
}
```

| الحالة | الرسالة |
|--------|---------|
| `400` | `weeklySubscriptionEnabled must be a boolean` |
| `404` | `Coach not found` |

بعد النجاح حدّثي السويتش من `data.weeklySubscriptionEnabled`.

قراءة الحالة والسعر:

```http
GET /api/coaches/my-profile
```

| الحقل | المعنى |
|-------|--------|
| `weeklySubscriptionEnabled` | حالة السويتش. الافتراضي `false` |
| `weeklyPrice` | اللي الرياضي هيدفعه في الأسبوع |
| `price` | سعر الكوتش الشهري اللي سجّله، من غير نسبة التطبيق |

---

## 2) كارت الكوتش عند الرياضي

```http
GET /api/coaches/with-subscription
Authorization: Bearer <access_token>
```

| الحقل | المعنى |
|-------|--------|
| `weeklySubscriptionEnabled` | `true` لو الكوتش موافق على الأسبوع |
| `weeklySubscriptionUsed` | `true` لو الرياضي الحالي سبق اشترك أسبوعي مع الكوتش ده |
| `weeklyPrice` | سعر الأسبوع للرياضي |
| `price` | السعر الشهري للرياضي، شامل نسبة التطبيق |

`weeklySubscriptionUsed` يبقى `true` لو فيه اشتراك أسبوعي حالته مش `rejected`: شغال، معلّق، منتهي، ملغي، متوقف، أو مسترد. الطلب المرفوض ما يستهلكش المرة، والرياضي يقدر يعيد طلب الأسبوع.

مثال: سعر الكوتش ١٠٠٠ ونسبة التطبيق ١٠٪.

| الخطة | الرياضي يدفع | الكوتش | التطبيق | المدة |
|-------|----------------|--------|---------|-------|
| `monthly` | ١١٠٠ | ١٠٠٠ | ١٠٠ | شهر |
| `weekly` | ٢٧٥ | ٢٥٠ | ٢٥ | ٧ أيام |

النسبة هي نفسها نسبة الشهر، وبعدين القسمة على ٤.

معاينة من غير اشتراك:

```http
POST /api/calculate-percentage
Content-Type: application/json
```

```json
{ "price": 1000, "plan": "weekly" }
```

`plan` اختياري، والافتراضي `monthly`. لو مش `monthly` أو `weekly` يرجع `400` بالرسالة `plan must be monthly or weekly`.

```json
{
  "message": "success",
  "plan": "weekly",
  "price": 275,
  "amount": 275,
  "platformFee": 25,
  "coachNetAmount": 250
}
```

على شاشة الكوتش، `weeklyPrice` من `my-profile` كفاية.

---

## 3) الرياضي يشترك

```http
POST /api/athlete/subscribe/:coachId
```

الدور: `athlete`. `:coachId` هو `id` الكوتش.

| الحقل | مطلوب | المعنى |
|-------|--------|--------|
| `subscriptionPlan` | لا | `weekly` أو `monthly`. من غيره يبقى `monthly` |
| `paymentMethod` | لا | `instapay` أو `wallet` أو `bank`. الافتراضي `instapay` |
| `transactionId` | لا | رقم العملية |
| `paymentImage` | لا | صورة التحويل |

```text
subscriptionPlan: weekly
paymentMethod: instapay
transactionId: 123456
paymentImage: <file>
```

متبعتيش `weekly` إلا لو زرار الأسبوع ظاهر حسب قاعدة العرض.

الرد `201`:

```json
{
  "message": "Subscription created successfully",
  "subscription": {
    "id": "64f0c2...",
    "coachId": "64f0aa...",
    "subscriptionPlan": "weekly",
    "amount": 275,
    "platformFee": 25,
    "coachNetAmount": 250,
    "currency": "EGP",
    "paymentStatus": "pending",
    "status": "pending",
    "startDate": "2026-10-13T00:00:00.000Z",
    "endDate": "2026-10-19T00:00:00.000Z",
    "paymentMethod": "instapay",
    "transactionId": "123456",
    "paymentImage": "/images/subscription-payments/....jpg"
  }
}
```

`startDate` و`endDate` شاملة ٧ أيام (يوم البداية + ٦). موافقة الأدمن تعيد حساب التاريخ من يوم الموافقة، والمبلغ المتخزن ما يتغيرش. الشهري يفضل شهر كامل.

| الحالة | الرسالة |
|--------|---------|
| `400` | `subscriptionPlan must be monthly or weekly` |
| `400` | `This coach does not offer a weekly subscription` |
| `400` | `You can subscribe weekly with this coach only once` |
| `400` | `You already have an active or pending subscription with this coach` |
| `403` | `Account is inactive` |
| `404` | `Athlete not found` أو `Coach not found` |

الاشتراك الأسبوعي والشهري مع نفس الكوتش ما يجتمعوش طول ما في طلب معلّق أو اشتراك شغال.

---

## 4) بعد التفعيل

`subscriptionPlan` على الاشتراك والتقويم يبقى `"weekly"`.

تقويم التمرين أسبوع واحد، والأسبوع ده مفتوح. الشهري لسه ٤ أسابيع، والأول والتاني مفتوحين.

اعرضي للرياضي مدة الأسبوع من `endDate`، مش شهر.
