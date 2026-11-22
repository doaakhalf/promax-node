# باقات ٣ و٦ و١٢ شهر (Mobile)

الاشتراك الشهري والأسبوعي زي ما هما. الباقات خيار إضافي: الكوتش يحط سعره للباقة، ونسبة التطبيق تتحسب على **سعره الشهري الأصلي** وتتضاعف بعدد الشهور.

متحسبوش العمولة ولا سعر اللاعب في التطبيق. استخدمي الأرقام الراجعة من الـ API.

كل الطلبات:

```http
X-Api-Key: <CLIENT_API_KEY>
Authorization: Bearer <access_token>
```

حفظ أسعار الباقات ومعاينة السعر `application/json`. طلب الاشتراك `multipart/form-data` عشان صورة التحويل. متبعتش `Content-Type` يدوي مع `FormData`.

---

## الأنواع

| `subscriptionPlan` | المدة | أسابيع التقويم والصرف |
|--------------------|-------|------------------------|
| `weekly` | ٧ أيام | ١ |
| `monthly` | شهر | ٤ |
| `quarterly` | ٣ شهور | ١٢ |
| `semiannual` | ٦ شهور | ٢٤ |
| `annual` | ١٢ شهر | ٤٨ |

أي قيمة غيرها ترجع `400`:

```text
subscriptionPlan must be monthly, weekly, quarterly, semiannual, or annual
```

نفس الرسالة على `plan` في معاينة السعر.

---

## القاعدة

العمولة = عمولة الشهر الأصلي × عدد شهور الباقة.

سعر الباقة اللي الكوتش يكتبه هو صافيه، ومش سعر اللاعب. لازم يكون **أكبر من صفر** و**أقل** من `سعر الشهر × عدد الشهور`. المساوي مرفوض، والأعلى مرفوض.

مثال كوتش سعره الشهري ٣٠٠ جنيه (الشريحة ٣٣٫٣٪، عمولة الشهر ١٠٠):

| الباقة | أقصى سعر للكوتش | مثال مقبول | عمولة التطبيق | اللاعب يدفع |
|--------|-----------------|------------|----------------|-------------|
| ٣ شهور | أقل من ٩٠٠ | ٨٥٠ | ٣٠٠ | ١١٥٠ |
| ٦ شهور | أقل من ١٨٠٠ | ١٧٠٠ | ٦٠٠ | ٢٣٠٠ |
| ١٢ شهر | أقل من ٣٦٠٠ | ٣٤٠٠ | ١٢٠٠ | ٤٦٠٠ |

٩٠٠ لباقة ٣ شهور يترفض. الخصم بينقص فلوس الكوتش بس، ومش بينقص العمولة.

لو الكوتش لسه محطّطش سعر باقة، متتعرضش للاعب.

---

## 1) الكوتش يحفظ سعر الباقة

```http
PUT /api/coaches/packages
Content-Type: application/json
```

الدور: `coach`. مش جزء من تعديل البروفايل، ومش بيدخل مراجعة الأدمن.

ابعتي الحقول اللي هتتغير بس. الحقل الغايب يفضل زي ما هو. `null` أو `""` يمسح الباقة.

```json
{
  "quarterlyPriceEgp": 850,
  "semiannualPriceEgp": 1700,
  "annualPriceEgp": null
}
```

الرد `200`:

```json
{
  "status": "success",
  "message": "Package prices saved successfully",
  "data": {
    "packages": {
      "quarterly": {
        "plan": "quarterly",
        "months": 3,
        "coachPrice": 850,
        "platformFee": 300,
        "price": 1150,
        "maxCoachPrice": 900
      },
      "semiannual": {
        "plan": "semiannual",
        "months": 6,
        "coachPrice": 1700,
        "platformFee": 600,
        "price": 2300,
        "maxCoachPrice": 1800
      },
      "annual": {
        "plan": "annual",
        "months": 12,
        "coachPrice": null,
        "platformFee": 1200,
        "price": null,
        "maxCoachPrice": 3600
      }
    }
  }
}
```

| الحقل | المعنى |
|-------|--------|
| `coachPrice` | صافي الكوتش. `null` لو الباقة مش مفعّلة |
| `platformFee` | عمولة التطبيق على الباقة كلها. ثابتة من السعر الشهري، حتى لو الباقة لسه فاضية |
| `price` | اللي اللاعب هيدفعه. `null` لو الباقة مش مفعّلة |
| `maxCoachPrice` | أول رقم مرفوض. المسموح أي سعر أقل منه |
| `months` | ٣ أو ٦ أو ١٢ |

بعد النجاح حدّثي الشاشة من `data.packages`.

| الحالة | الشكل |
|--------|--------|
| `422` | `{ "message": "Validation error", "errors": { "quarterlyPriceEgp": "سعر باقة ٣ شهور لازم يكون أقل من ٩٠٠ جنيه" } }` |
| `422` | `{ "errors": { "packages": "أرسل سعر باقة واحدة على الأقل" } }` لو البودي فاضي |
| `404` | `Coach not found` |

رسائل الرفض الشائعة:

```text
سعر باقة ٣ شهور لازم يكون أقل من ٩٠٠ جنيه
سعر باقة ٦ شهور لازم يكون أقل من ١٨٠٠ جنيه
سعر باقة ١٢ شهر لازم يكون أقل من ٣٦٠٠ جنيه
سعر باقة ٣ شهور لازم يكون أكبر من صفر
سعر الباقة غير صالح
```

لو فيه تعديل سعر شهري لسه تحت مراجعة الأدمن، السقف يتاخد من **الأقل** بين السعر الحالي والسعر المقترح. عشان كده الحفظ ممكن يترفض رغم إن الرقم أقل من السعر الظاهر دلوقتي.

تخفيض السعر الشهري من `PUT /api/coaches/edit` يترفض برضه لو باقة محفوظة تبقى مساوية للسقف الجديد أو أعلى. الخطأ ييجي في `errors.quarterlyPriceEgp` أو `semiannualPriceEgp` أو `annualPriceEgp`. خفّضي الباقة الأول، وبعدين السعر الشهري.

---

## 2) معاينة السعر قبل الحفظ

```http
POST /api/calculate-percentage
Content-Type: application/json
```

من غير توكن. للباقات لازم تبعتي السعر الشهري الأصلي مع سعر الباقة:

```json
{
  "plan": "quarterly",
  "monthlyPrice": 300,
  "price": 850
}
```

`price` هنا صافي الكوتش، مش سعر اللاعب.

الرد `200`:

```json
{
  "message": "success",
  "plan": "quarterly",
  "months": 3,
  "price": 1150,
  "amount": 1150,
  "platformFee": 300,
  "coachNetAmount": 850,
  "maxCoachPrice": 900
}
```

اعرضي للكوتش `coachNetAmount` و`platformFee` و`price` قبل ما يضغط حفظ.

| الحالة | الرسالة |
|--------|---------|
| `400` | `monthlyPrice is required for package plans` |
| `400` | `plan must be monthly, weekly, quarterly, semiannual, or annual` |
| `422` | رسالة السقف، ومعاها `maxCoachPrice` |

الشهر والأسبوع على نفس المسار من غير `monthlyPrice`، زي [WEEKLY_SUBSCRIPTION_FRONTEND.md](WEEKLY_SUBSCRIPTION_FRONTEND.md). رسالة الـ `400` بتاعتهم اتوسعت وبقت تشمل أنواع الباقات.

على شاشة الكوتش، `packages` من `GET /api/coaches/my-profile` فيها السقف والعمولة حتى قبل ما يكتب السعر. المعاينة محتاجاها لما يكتب رقم عشان تشوفي سعر اللاعب.

---

## 3) عرض الباقات

**الكوتش**

```http
GET /api/coaches/my-profile
```

`packages` بالشكل الكامل اللي فوق: `coachPrice` و`platformFee` و`price` و`maxCoachPrice`.

`price` على جذر البروفايل لسه سعر الكوتش الشهري من غير نسبة التطبيق. سعر اللاعب للشهر هو مش ده.

**الرياضي**

```http
GET /api/coaches/with-subscription
Authorization: Bearer <access_token>
```

كل باقة يا `null` يا كائن فيه سعر اللاعب بس:

```json
{
  "packages": {
    "quarterly": { "months": 3, "price": 1150 },
    "semiannual": null,
    "annual": { "months": 12, "price": 4600 }
  }
}
```

اعرضي زرار الباقة فقط لو القيمة مش `null`. السعر من `price`. متستخدميش `GET /api/coaches` العام في قرار عرض الباقة.

لو شاشة تفاصيل الكوتش من `GET /api/coaches/my-profile/:id`، الرد فيه صافي الكوتش والعمولة. للاعب اعرضي `packages.*.price` بس.

---

## 4) الرياضي يشترك

```http
POST /api/athlete/subscribe/:coachId
```

الدور: `athlete`. `:coachId` هو `id` الكوتش.

| الحقل | مطلوب | المعنى |
|-------|--------|--------|
| `subscriptionPlan` | لا | `weekly` أو `monthly` أو `quarterly` أو `semiannual` أو `annual`. من غيره يبقى `monthly` |
| `paymentMethod` | لا | `instapay` أو `wallet` أو `bank`. الافتراضي `instapay` |
| `transactionId` | لا | رقم العملية |
| `paymentImage` | لا | صورة التحويل |

متبعتيش سعر. السيرفر بياخد سعر الباقة المحفوظ عند الكوتش.

```text
subscriptionPlan: quarterly
paymentMethod: instapay
transactionId: 123456
paymentImage: <file>
```

الرد `201`:

```json
{
  "message": "Subscription created successfully",
  "subscription": {
    "id": "64f0c2...",
    "coachId": "64f0aa...",
    "subscriptionPlan": "quarterly",
    "amount": 1150,
    "platformFee": 300,
    "coachNetAmount": 850,
    "currency": "EGP",
    "paymentStatus": "pending",
    "status": "pending",
    "startDate": "2026-01-15T00:00:00.000Z",
    "endDate": "2026-04-14T00:00:00.000Z",
    "paymentMethod": "instapay",
    "transactionId": "123456",
    "paymentImage": "/images/subscription-payments/....jpg"
  }
}
```

`amount` هو اللي اللاعب دفعه. المدة شاملة: نفس اليوم بعد عدد الشهور، ناقص يوم. المثال من ١٥ يناير لـ ١٤ أبريل.

موافقة الأدمن تعيد حساب `startDate` و`endDate` من يوم الموافقة. المبلغ ونوع الاشتراك ما يتغيروش.

| الحالة | الرسالة |
|--------|---------|
| `400` | `subscriptionPlan must be monthly, weekly, quarterly, semiannual, or annual` |
| `400` | `This coach does not offer this package` |
| `400` | `سعر باقة ٣ شهور لازم يكون أقل من ٩٠٠ جنيه` لو السعر المحفوظ بقى مخالف للسقف |
| `400` | `You already have an active or pending subscription with this coach` |
| `403` | `Account is inactive` أو حد اشتراكات الكوتش اكتمل |
| `404` | `Athlete not found` أو `Coach not found` |

الباقة والشهر والأسبوع ما يجتمعوش مع نفس الكوتش طول ما فيه طلب معلّق أو اشتراك شغال.

---

## 5) بعد التفعيل

`subscriptionPlan` على الاشتراك والتقويم يفضل `quarterly` أو `semiannual` أو `annual`.

التقويم يتقسم على كل مدة الباقة، مش ٤ أسابيع. أول أسبوعين مفتوحين زي الشهري، والباقي يتفتح مع تقدم الأسابيع.

اعرضي المدة من `startDate` و`endDate`. صرف الكوتش يفضل أسبوعي على الأسابيع اللي اتسلمت، مش مبلغ الباقة كله يوم الدفع.
