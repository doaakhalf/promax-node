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

لو الرسالة فيها رقم تليفون، إيميل، لينك/كلمة سوشيال (`فيس` / `انستا` / …)، أو `@handle` — السيرفر بيرفض **قبل الحفظ**. مفيش `Message` في الداتابيز، مفيش socket، مفيش notification. الملف المرفوض بيتمسح ومش بيتنشر على `/images`.

```json
{
  "status": "error",
  "code": "CONTACT_SHARING_BLOCKED",
  "message": "You can't share phone numbers, social media, or other contact details in chat."
}
```

### مهم جدًا للفرونت (سبب إن الطرف التاني كان بـ«يشوف» الرسالة)

لو التطبيق بيعمل **optimistic UI** (يعرض الرسالة/الصورة قبل رد السيرفر):

1. ابعتي الطلب.
2. لو الرد `400` و`code === "CONTACT_SHARING_BLOCKED"` (أو `IMAGE_SCAN_FAILED`):
   - **امسحي** الرسالة من قائمة الشات المحلية فورًا (عند المرسل).
   - **متسيبيش** الـ bubble لا كـ sent ولا كـ failed ظاهر كأنه اتبعت.
   - اعرضي `message` في snackbar / dialog بس.
3. الطرف التاني **مش المفروض** يضيف أي حاجة محليًا إلا من:
   - رد `201` الناجح، أو
   - سوكت `chat:new_message` (والسيرفر بيبعت السوكت بعد الحفظ الناجح فقط).

لو المرسل شاف الصورة/`فيس` بعد الرفض، أو الطرف التاني شافها من غير ما يعمل refresh من الـ API — ده باغ فرونت، مش السيرفر.

أرقام التمرين القصيرة (`3 reps`, `10 kg`) لسه بتتمر.

### فحص الصور

لو المرفق صورة، السيرفر بيفحص QR والنص جوّاها. صوت وفيديو وPDF مش بيتفحصوا. اسم الملف مش بيتفحص.

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
| `CONTACT_SHARING_BLOCKED` | لقى رقم/سوشيال/إيميل في النص أو جوّا الصورة | امسحي الـ optimistic bubble + اعرضي `message` |
| `IMAGE_SCAN_FAILED` | مقدرش يفحص الصورة | امسحي الـ optimistic bubble + خلّي المستخدم يحاول تاني |

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
