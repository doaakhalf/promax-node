# فيديو تعريف الكوتش

الكوتش يرفع فيديو قصير يعرّف فيه نفسه (تسويق). الفيديو **مش ظاهر للزوار** إلا بعد موافقة الأدمن. الرفض وطلب التعديل بيرجعوا بسبب، والكوتش يقدر يرفع نسخة جديدة أو يمسح الفيديو في أي وقت.

ده مسار مستقل عن `videoUrl`. متستخدميش `videoUrl` للفيديو ده، ومتبعتيهوش في تعديل البروفايل.

كل الطلبات:

```http
X-Api-Key: <CLIENT_API_KEY>
Authorization: Bearer <access_token>
```

الرفع `multipart/form-data`. متبعتيش `Content-Type` يدوي مع `FormData`.

رابط الملف مسار من جذر الهوست ويبدأ بـ `/`:

```text
{API_HOST}{url}
```

مثال: `url` = `/videos/coach-intro/1730000000-123.mov` يبقى `https://host/videos/coach-intro/1730000000-123.mov`.

---

## الحدود (قبل الرفع)

| القيد | القيمة |
|--------|--------|
| المدة | 60 ثانية |
| الحجم | 80 ميجا |
| الصيغ | `mp4` و `mov` و `m4v` |
| اسم الحقل | `video` |

من الآيفون الملف غالبًا `.MOV` ونوعه `video/quicktime` (HEVC). ارفعيه كما هو، من غير تحويل ومن غير تدوير. السيرفر بيقرأ الاتجاه من الملف.

قصّري الفيديو في التطبيق لـ 60 ثانية قبل الإرسال. لو أطول أو أكبر، السيرفر بيرفضه والرسالة بالعربي في `message` — اعرضيها زي ما هي.

---

## 1. رفع الفيديو

```http
POST /api/coaches/intro-video
Authorization: Bearer <token>   (كوتش فقط)
```

```text
video: <file>
```

نجاح `200`:

```json
{
  "status": "success",
  "message": "تم إرسال الفيديو للمراجعة",
  "data": {
    "published": null,
    "submission": {
      "status": "pending",
      "url": "/videos/coach-intro/1730000000-123.mov",
      "durationSeconds": 42.5,
      "sizeBytes": 18000000,
      "submittedAt": "2026-11-16T10:00:00.000Z",
      "reviewedAt": null,
      "reason": null
    }
  }
}
```

`published` النسخة الظاهرة للناس. `submission` آخر رفع وحالته. بعد أول رفع، `published` تكون `null` لحد الموافقة.

لو كان فيه فيديو موافق عليه ورفع نسخة جديدة: `published` تفضل القديمة، و`submission.status` تبقى `pending`.

أخطاء الرفع `400`. الرسالة في `message`:

| السبب | الرسالة |
|--------|---------|
| مفيش ملف | `ارفع ملف الفيديو` |
| صيغة غلط | `صيغة الفيديو غير مدعومة. استخدم mp4 أو mov أو m4v` |
| أكبر من 80 ميجا | `حجم الفيديو أكبر من 80 ميجا` |
| أطول من 60 ثانية | `مدة الفيديو أطول من 60 ثانية` |
| المدة مش مقروءة | `تعذر قراءة مدة الفيديو. ارفع ملف mp4 أو mov من الآيفون` |

شكل الخطأ:

```json
{ "success": false, "status": "error", "message": "مدة الفيديو أطول من 60 ثانية" }
```

بعض الأخطاء بترجع `success: false` من غير `status`. اعتمدي على `message`.

---

## 2. جلب فيديو الكوتش لوحده

```http
GET /api/coaches/intro-video
Authorization: Bearer <token>   (كوتش فقط)
```

نفس شكل `data` في الرفع. لو مفيش أي فيديو:

```json
{
  "status": "success",
  "message": "Retrieved intro video",
  "data": { "published": null, "submission": null }
}
```

استخدمي الطلب ده لشاشة «فيديو التعريف» عند الكوتش. مش للبروفايل العام.

### الحالات

| `submission.status` | المعنى على الشاشة |
|---------------------|-------------------|
| `pending` | قيد المراجعة. متقوليش إنه ظاهر إلا لو `published` فيها فيديو قديم |
| `approved` | آخر رفع هو النسخة الظاهرة |
| `rejected` | مرفوض. اعرضي `submission.reason` وخلي الرفع متاح |
| `changes_requested` | مطلوب تعديل. اعرضي `submission.reason` وخلي الرفع متاح |

الرفع متاح في كل الحالات، بما فيها `pending` (الاستبدال يلغي الملف المنتظر فقط).

التشغيل للكوتش: شغّلي `submission.url` عشان يشوف آخر نسخة. لو `published` موجودة ورابطها مختلف، اعرضي تحتها إن النسخة الظاهرة للناس لسه القديمة.

---

## 3. حذف الفيديو

```http
DELETE /api/coaches/intro-video
Authorization: Bearer <token>   (كوتش فقط)
```

مفيش body. الحذف متاح في كل الحالات: `pending` و `approved` و `rejected` و `changes_requested`، وبعد الموافقة كمان.

بيمسح النسخة الظاهرة وآخر رفع مع بعض، والملفات من السيرفر. لو الاتنين نفس الملف يتمسح مرة واحدة. لو فيه فيديو ظاهر وفيديو جديد لسه تحت المراجعة، الاتنين يتمسحوا.

نجاح `200`، حتى لو مفيش فيديو أصلًا:

```json
{
  "status": "success",
  "message": "تم حذف فيديو التعريف",
  "data": { "published": null, "submission": null }
}
```

بعد النجاح:

- شاشة الكوتش تبقى فاضية، والرفع متاح من جديد.
- بروفايل الزائر: `introVideo` تبقى `null`.
- متستنيش مراجعة أدمن. الحذف فوري ومش بيرجع إشعار.

---

## 4. البروفايل

```http
GET /api/coaches/my-profile
GET /api/coaches/my-profile/:id
```

الحقل `introVideo`. **شكله بيتغير** حسب المشاهد.

### الزائر (رياضي أو كوتش تاني)

نسخة موافَق عليها فقط، أو `null`. مفيش حالة ولا سبب.

```json
"introVideo": {
  "url": "/videos/coach-intro/1730000000-123.mov",
  "durationSeconds": 42.5,
  "sizeBytes": 18000000,
  "approvedAt": "2026-11-16T12:00:00.000Z"
}
```

لو مفيش فيديو ظاهر: `"introVideo": null`. متستنيش `published` هنا.

### صاحب البروفايل

نفس كائن `GET /api/coaches/intro-video`:

```json
"introVideo": {
  "published": { "url": "/videos/coach-intro/old.mov", "durationSeconds": 30, "sizeBytes": 9000000, "approvedAt": "2026-11-01T12:00:00.000Z" },
  "submission": {
    "status": "changes_requested",
    "url": "/videos/coach-intro/new.mov",
    "durationSeconds": 55,
    "sizeBytes": 20000000,
    "submittedAt": "2026-11-16T10:00:00.000Z",
    "reviewedAt": "2026-11-16T11:00:00.000Z",
    "reason": "قصّر الفيديو ووضّح تخصصك"
  }
}
```

لو الكوتش لسه مارفعش: `{ "published": null, "submission": null }`.

اعرضي للزائر فيديو واحد من `introVideo.url`. عند الكوتش على بروفايله استخدمي `published` للظاهر و`submission` للتنبيه.

`videoUrl` لسه موجود ومش متعلق بالميزة دي.

---

## التشغيل

- استخدمي مشغّل فيديو عادي على الرابط الكامل، مع `playsInline` على الآيفون.
- متدوّريش الصورة في التطبيق؛ ملف الآيفون فيه اتجاه البورتريه.
- فيديو HEVC من الآيفون يشتغل على iOS. لو مشغّل أندرويد رفض الملف، افتحي الرابط في مشغّل النظام.

---

## الإشعارات

| `type` | امتى | `data` |
|--------|------|--------|
| `intro_video_approved` | الأدمن وافق | `{ "status": "approved" }` |
| `intro_video_rejected` | الأدمن رفض | `{ "status": "rejected", "reason": "..." }` |
| `intro_video_changes_requested` | الأدمن طلب تعديل | `{ "status": "changes_requested", "reason": "..." }` |

العنوان والنص بالعربي في الإشعار. بعد أي إشعار من دول، اعملي `GET /api/coaches/intro-video` وحدّثي الشاشة. متعتبريش الفيديو ظاهر للناس إلا لما `published` ترجع.
