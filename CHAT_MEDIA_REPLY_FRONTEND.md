# الشات: صوت، فيديو، ورد على رسالة (Mobile)

الإرسال لسه على نفس الطلب. الصوت والفيديو مرفقات، والرد حقل اختياري على الرسالة.

```http
POST /api/chat/conversations/:id/messages
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

متبعتش `Content-Type` يدوي مع `FormData`.

الحقول:

| الحقل | مطلوب | المعنى |
|-------|--------|--------|
| `text` | لا | نص الرسالة |
| `attachments` | لا | ملفات، لحد 10. الاسم يتكرر لكل ملف |
| `replyTo` | لا | `id` الرسالة اللي بترد عليها، في نفس المحادثة |

لازم نص أو مرفق واحد على الأقل. من غير `replyTo` الرسالة عادية.

شوف كمان [CHAT_API.md](./CHAT_API.md) و[CHAT_FREE_TRIAL_LIMIT.md](./CHAT_FREE_TRIAL_LIMIT.md).

---

## متى تظهر أزرار الصوت والفيديو

من `chatPermission` على المحادثة:

| الحالة | `canSend` | `canSendMedia` | الأزرار |
|--------|-----------|----------------|---------|
| تجربة مجانية | `true` | `false` | نص وصور وPDF بس |
| اشتراك `active` بين الكوتش والرياضي | `true` | `true` | صوت وفيديو كمان |
| شات الأدمن (`admin_coach` / `admin_athlete`) | `true` | `true` | صوت وفيديو من غير اشتراك |
| التجربة خلصت أو الحساب مقفول | `false` | `false` | صندوق الكتابة مقفول |

متظهرش زر الصوت أو الفيديو إلا لما `canSendMedia === true`.

---

## الأنواع والحجم

| النوع | الامتداد | MIME | الحد |
|-------|----------|------|------|
| صوت | `.mp3` `.m4a` `.aac` `.wav` `.ogg` `.webm` | `audio/mpeg` `audio/mp4` `audio/x-m4a` `audio/aac` `audio/wav` `audio/ogg` `audio/webm` | 15 MB |
| فيديو | `.mp4` `.mov` `.webm` `.3gp` | `video/mp4` `video/quicktime` `video/webm` `video/3gpp` | 50 MB |

تسجيل الصوت اللي طالع `.mp4` مع MIME `audio/mp4` يتقبل كصوت. ملف أكبر من الحد، أو نوع مش في الجدول، يرجع `400`.

---

## الإرسال

```text
text: بكرة الساعة 6
attachments: <file>
replyTo: 64f0c1...
```

`replyTo` و`text` يتشالوا لو مفيش رد أو مفيش نص.

الرد `201`:

```json
{
  "message": {
    "id": "64f0c2...",
    "conversationId": "64f0aa...",
    "text": "بكرة الساعة 6",
    "attachments": [
      {
        "url": "images/chats/1730000000-123.m4a",
        "type": "audio",
        "originalName": "voice.m4a",
        "mimeType": "audio/mp4",
        "size": 240110
      }
    ],
    "replyTo": {
      "id": "64f0c1...",
      "senderRole": "coach",
      "text": "هنتدرب امتى؟"
    },
    "senderId": "...",
    "senderRole": "athlete",
    "createdAt": "2026-10-10T13:00:00.000Z"
  },
  "conversation": {}
}
```

`attachments[].type`: `"image"` | `"pdf"` | `"audio"` | `"video"`.

رابط الملف: `{API_HOST}/{url}` من غير سلاش زيادة. مثال: `https://host/images/chats/1730000000-123.m4a`.

---

## العرض

- `audio`: مشغّل صوت.
- `video`: مشغّل فيديو.
- `image` و`pdf`: زي قبل كده.
- الرسالة من غير نص: اعرض المرفق بس.

آخر رسالة في قائمة المحادثات (`lastMessage.text`) لما مفيش نص:

| المرفق | النص |
|--------|------|
| صورة | `📷 Photo` |
| صوت | `🎤 Voice message` |
| فيديو | `🎥 Video` |
| غير كده | `📎 Attachment` |

نفس النصوص دي تيجي في `replyTo.text` لو الرسالة الأصلية مرفق من غير نص. اقتباس النص الأصلي يتقص عند 200 حرف ويتقفل بـ `…`.

السوكت `chat:new_message` بيرجع نفس شكل `message`، وفيه `attachments` و`replyTo`.

---

## الرد على رسالة

1. المستخدم يختار Reply على رسالة.
2. فوق صندوق الكتابة يظهر اقتباس من `text`، أو من نوع المرفق لو مفيش نص.
3. الإلغاء يشيل الاقتباس. الرسالة اللي بعده تتبعت من غير `replyTo`.
4. الإرسال يبعت `replyTo` = `id` الرسالة الأصلية، مع النص أو الملف الجديد.
5. جوه فقاعة الرد اعرض `replyTo.text` فوق محتوى الرسالة.

`replyTo` في الرسالة المقروءة:

```json
{
  "id": "64f0c1...",
  "senderRole": "coach",
  "text": "هنتدرب امتى؟"
}
```

لو الرسالة مش رد: `"replyTo": null`.

الاقتباس لقطة من وقت الإرسال. متستناش الرسالة الأصلية تكون في الصفحة الحالية عشان تعرضه.

الرد متاح في شات الكوتش والرياضي وفي شات الأدمن. الصوت والفيديو جوه الرد لسه مربوطين بـ `canSendMedia`.

---

## الأخطاء

التجربة خلصت:

```json
{
  "status": "error",
  "code": "MESSAGE_LIMIT_REACHED",
  "message": "Free message limit reached"
}
```

صوت أو فيديو من غير اشتراك فعّال بين الكوتش والرياضي:

```json
{
  "status": "error",
  "code": "MEDIA_REQUIRES_SUBSCRIPTION",
  "message": "Voice and video require an active subscription"
}
```

اقفل أزرار الصوت والفيديو واعرض إن الميزة للاشتراك الفعّال. شات الأدمن مبيرجعش الكود ده.

الرد على رسالة مش موجودة أو من محادثة تانية:

```json
{
  "status": "error",
  "message": "Reply target not found"
}
```

ملف أكبر من الحد:

```json
{
  "status": "error",
  "message": "Maximum file size is 50 MB."
}
```

الصوت فوق 15MB:

```json
{
  "status": "error",
  "message": "Maximum voice message size is 15 MB."
}
```

نوع ملف مش مدعوم:

```json
{
  "status": "error",
  "message": "Unsupported file type."
}
```
