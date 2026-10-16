# تحديثات الفرونت الأخيرة

تلات تغييرات بس: منع بيانات التواصل في الشات، إثبات الدفع في أرباح الكوتش، وفلتر الاشتراك الأسبوعي في قائمة الكوتشز.

---

## 1) الشات: منع مشاركة بيانات التواصل

نفس طلب الإرسال، مفيش endpoint جديد:

```http
POST /api/chat/conversations/:id/messages
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

الفلترة على شات `coach_athlete` فقط (كوتش ↔ رياضي). شات الأدمن مش بيتفلتر.

لو الرسالة فيها رقم تليفون، إيميل، لينك/كلمة سوشيال، أو `@handle` — السيرفر بيرفض قبل الحفظ. مفيش socket ومفيش notification.

```json
{
  "status": "error",
  "code": "CONTACT_SHARING_BLOCKED",
  "message": "You can't share phone numbers, social media, or other contact details in chat."
}
```

اعرضي `message` للمستخدم. أرقام التمرين القصيرة (`3 reps`, `10 kg`) لسه بتتمر.

### فحص الصور

لو المرفق صورة، السيرفر بيفحص QR والنص جوّاها. صوت وفيديو وPDF مش بيتفحصوا.

لو الفحص نفسه فشل (صورة تالفة، timeout، خطأ تقني) — مش لما يلاقي بيانات تواصل:

```json
{
  "status": "error",
  "code": "IMAGE_SCAN_FAILED",
  "message": "Couldn't check this image. Try again."
}
```

| `code` | المعنى | الفرونت |
|--------|--------|---------|
| `CONTACT_SHARING_BLOCKED` | لقى رقم/سوشيال/إيميل في النص أو اسم الملف أو الصورة | اعرضي الرسالة، الرسالة متتبعتش |
| `IMAGE_SCAN_FAILED` | مقدرش يفحص الصورة | اعرضي الرسالة وخلّي المستخدم يحاول تاني |

مفيش تغيير في شكل الإرسال ولا في الـsocket.

شوف كمان [CHAT_API.md](./CHAT_API.md).

---

## 2) أرباح الكوتش: مرجع الدفع وصورة الإثبات

اتضافوا على سجل المدفوعات وتفاصيل الـpayout:

```http
GET /api/coaches/earnings/history
GET /api/coaches/earnings/history/:payoutId
Authorization: Bearer <access_token>
```

دور: `coach`.

كل عنصر payout في التاريخ، وتفاصيل الـpayout، فيهم:

| الحقل | النوع | المعنى |
|-------|--------|--------|
| `paymentReference` | `string \| null` | رقم/مرجع التحويل اللي الأدمن سجّله |
| `paymentProofImage` | `string \| null` | مسار صورة إثبات الدفع، أو `null` |

مثال من عنصر جوه `months[].payouts[]`:

```json
{
  "payoutId": "...",
  "amount": 1500,
  "paidAt": "2026-08-16T10:00:00.000Z",
  "paymentReference": "TRX-12345",
  "paymentProofImage": "images/payouts/proof-....jpg"
}
```

اعرضي المرجع وصورة الإثبات لو القيم مش `null`. لو `null`، اخفي الجزء ده.

---

## 3) فلتر الاشتراك الأسبوعي في قائمة الكوتشز

على قائمة الكوتشز للرياضي:

```http
GET /api/coaches/with-subscription?weeklySubscriptionEnabled=true
Authorization: Bearer <access_token>
```

| Query | المعنى |
|-------|--------|
| `weeklySubscriptionEnabled=true` | كوتشز فاتحين الاشتراك الأسبوعي بس |
| `weeklySubscriptionEnabled=false` | كوتشز مقفلين الاشتراك الأسبوعي بس |
| مش موجود | من غير فلتر على الحقل ده |

القيمة نص `"true"` / `"false"` في الـquery (زي باقي الفلاتر). لو متحطتش، الفلتر مش بيتطبق.

ممكن تتدمج مع الفلاتر الموجودة (`gender`, `minPrice`, `maxPrice`, …).

شوف كمان [WEEKLY_SUBSCRIPTION_FRONTEND.md](./WEEKLY_SUBSCRIPTION_FRONTEND.md).
