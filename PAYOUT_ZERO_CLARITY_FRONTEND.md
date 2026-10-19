# Payout / Earnings Zero Clarity — تحديث الفرونت

لما الكوتش ما يعيّنش تمارين الأسبوع بالكامل، المستحق بيفضل **٠** (القاعدة ما اتغيرتش). الجديد: الـ API بيرجع **سبب واضح + رسالة عربية** بدل رقم صفر لوحده.

---

## إيه اللي اتغيّر؟

| السياق | قبل | بعد |
|--------|-----|-----|
| Dashboard الأرباح | `nextPayout.amount` فقط | + `message`, `primaryReason`, `reasonCounts`, عدّاد الأسابيع |
| تفاصيل الـ next payout | `ineligibleReason` code فقط | + `ineligibleReasonLabel` عربي + `assignedDaysCount` / `requiredDaysCount` |
| تفاصيل payout في الـ history | أسابيع eligible فقط | كل الأسابيع (بما فيها الـ ٠) مع السبب |
| Admin upcoming zeros | مخفية افتراضياً | نفس السلوك + `?includeZero=true` + حقول السبب على كل صف |

**قاعدة الاستحقاق (ثابتة):** الأسبوع يدفع فقط لو كل أيام التمرين `isAssigned: true`. غير كده → `ineligibleReason: "no_assignment"` و `amount: 0`.

---

## 1) Dashboard الكوتش

```http
GET /api/coaches/earnings
Authorization: Bearer <coach_token>
```

على `data.nextPayout` و `data.followingPeriod`:

| الحقل | النوع | متى |
|--------|------|-----|
| `amount` | number | زي ما هو |
| `eligibleWeeksCount` | number | عدد الأسابيع المستحقة |
| `ineligibleWeeksCount` | number | عدد الأسابيع غير المستحقة |
| `reasonCounts` | object | مثلاً `{ "no_assignment": 3 }` |
| `primaryReason` | string \| null | السبب الأكثر تكراراً |
| `message` | string \| null | رسالة عربية جاهزة للـ UI — **فقط لما `amount === 0`** |

### مثال لما المستحق ٠

```json
{
  "nextPayout": {
    "amount": 0,
    "scheduledDate": "...",
    "periodLabel": "...",
    "eligibleWeeksCount": 0,
    "ineligibleWeeksCount": 3,
    "reasonCounts": { "no_assignment": 3 },
    "primaryReason": "no_assignment",
    "message": "المستحق ٠ ج.م لأن 3 أسابيع بدون تعيين تمارين كامل"
  }
}
```

### المطلوب في الـ UI

- لو `nextPayout.amount === 0` و فيه `message` → اعرضها تحت المبلغ (أو بدل placeholder فاضي).
- لو `amount > 0` → `message` بيكون `null`؛ متحتاجش تعرض سبب.

---

## 2) تفاصيل الـ next payout (breakdown)

```http
GET /api/coaches/earnings/next-payout-details
Authorization: Bearer <coach_token>
```

### على مستوى الـ period (`data`)

نفس حقول الملخص: `message`, `primaryReason`, `reasonCounts`, `eligibleWeeksCount`, `ineligibleWeeksCount` + `totalAmount`.

### على كل أسبوع — `data.items[].weeks[]`

| الحقل | النوع | معنى |
|--------|------|------|
| `amount` | number | المستحق للأسبوع (٠ لو مش eligible) |
| `isEligible` | boolean | هل هيتحسب في الـ payout |
| `ineligibleReason` | string \| null | code: شوف الجدول تحت |
| `ineligibleReasonLabel` | string \| null | نص عربي جاهز للعرض |
| `assignedDaysCount` | number | أيام معيَّنة |
| `requiredDaysCount` | number | إجمالي أيام التمرين في الأسبوع |

### مثال أسبوع بدون assign كامل

```json
{
  "weekIndex": 2,
  "periodLabel": "...",
  "amount": 0,
  "isEligible": false,
  "ineligibleReason": "no_assignment",
  "ineligibleReasonLabel": "لم يتم تعيين التمارين بالكامل لهذا الأسبوع",
  "assignedDaysCount": 2,
  "requiredDaysCount": 4
}
```

### المطلوب في الـ UI

- لكل أسبوع غير eligible: اعرض `ineligibleReasonLabel` (أو fallback على الـ code).
- لو `no_assignment`: يفضّل تظهر `assignedDaysCount / requiredDaysCount` (مثلاً «٢ من ٤ أيام»).
- ملخص الفترة: استخدم `data.message` لو `totalAmount === 0`.

---

## 3) تفاصيل payout من الـ history

```http
GET /api/coaches/earnings/history/:payoutId
Authorization: Bearer <coach_token>
```

- بيرجع نفس ملخص الفترة (`message`, `primaryReason`, …).
- `trainees[].weeks[]` بقى يشمل **الأسابيع غير المستحقة** كمان (مش eligible فقط)، بنفس شكل الـ week enrichment فوق.

استخدمه لو عايزين توضحوا ليه جزء من الاشتراك ما اتحسبش جوه تحويل سابق.

---

## 4) أكواد `ineligibleReason`

| code | `ineligibleReasonLabel` (عربي) |
|------|--------------------------------|
| `no_assignment` | لم يتم تعيين التمارين بالكامل لهذا الأسبوع |
| `pending_payment` | اشتراك المتدرب لم يُدفع بعد |
| `already_paid` | تم صرف هذا الأسبوع مسبقاً |
| `partial_week` | الأسبوع خارج فترة التحويل الحالية |

`primaryReason` بياخد أعلى count؛ عند التعادل الأولوية لـ `no_assignment`.

---

## 5) Admin (اختياري للـ app الكوتش)

```http
GET /api/admin/payouts/upcoming?includeZero=true
GET /api/admin/payouts/upcoming/:coachId
```

- كل صف في upcoming فيه: `message`, `primaryReason`, `reasonCounts`, `eligibleWeeksCount`, `ineligibleWeeksCount`.
- بدون `includeZero=true` الـ zeros بتفضل مخفية (سلوك قديم).
- تفاصيل الكوتش = نفس shape بتاع next-payout-details + بيانات الكوتش.

---

## Checklist سريع للفرونت (Coach app)

1. شاشة الأرباح الرئيسية: اعرض `nextPayout.message` لما المبلغ ٠.
2. شاشة تفاصيل التحويل القادم: اعرض سبب كل أسبوع من `weeks[].ineligibleReasonLabel` + عدّاد الأيام.
3. (اختياري) تفاصيل تاريخ الدفع: نفس الـ weeks enrichment.
4. متحتاجش تبني الرسائل عربي من الفرونت — الباك بيرجع `message` / `ineligibleReasonLabel` جاهزين.
5. متغيّرش منطق الحساب عندك؛ الـ ٠ صحيح لما التعيين مش كامل.

---

## ملاحظات

- `followingPeriod` له نفس حقول الملخص زي `nextPayout`.
- لو مفيش line items أصلاً (مفيش اشتراكات في الفترة): `message` و `primaryReason` هيبقوا `null` و الـ counts = ٠.
- Admin Angular dashboard اتحدّث بنفس الحقول (toggle Show zero payouts + week breakdown).
