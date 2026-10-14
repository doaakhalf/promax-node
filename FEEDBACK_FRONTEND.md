# الشكاوي والاقتراحات (Mobile)

الرياضي أو الكوتش يرسل شكوى أو اقتراح. العنوان والنوع والنص من الفورم. المرسل يتسجل من التوكن، متبعتوش `userId` في الجسم.

مفيش طلب يجيب رسائل المستخدم السابقة. بعد النجاح اعرضي رسالة تم الإرسال.

كل الطلبات:

```http
X-Api-Key: <CLIENT_API_KEY>
Authorization: Bearer <access_token>
Content-Type: application/json
```

الدور: `athlete` أو `coach`. الأدمن مش بيستخدم الطلب ده.

---

## الإرسال

```http
POST /api/feedback
```

```json
{
  "title": "مشكلة في الاشتراك",
  "type": "complaint",
  "body": "الدفع اتقبل والصورة لسه معلّقة من يومين."
}
```

| الحقل | مطلوب | القيم |
|-------|--------|--------|
| `title` | نعم | نص، بعد القص لحد 120 حرف |
| `type` | نعم | `complaint` أو `suggestion` |
| `body` | نعم | نص الشكوى أو الاقتراح، بعد القص لحد 2000 حرف |

المسافات في أول النص وآخره بتتشال قبل التحقق. النص الفاضي بعد القص مرفوض.

الرد `201`:

```json
{
  "status": "success",
  "message": "Feedback submitted successfully",
  "data": {
    "id": "6714c0e2a1b2c3d4e5f60718",
    "title": "مشكلة في الاشتراك",
    "type": "complaint",
    "body": "الدفع اتقبل والصورة لسه معلّقة من يومين.",
    "createdAt": "2026-10-14T11:20:00.000Z"
  }
}
```

اعرضي النجاح من `status === "success"`. مش لازم تخزني `data`؛ مفيش شاشة قائمة عند المستخدم.

---

## الأخطاء

| الحالة | الرسالة |
|--------|---------|
| `400` | `Title is required and must be at most 120 characters` |
| `400` | `Type must be complaint or suggestion` |
| `400` | `Body is required and must be at most 2000 characters` |
| `401` | توكن ناقص أو منتهي |
| `403` | الدور مش `athlete` ولا `coach`، أو `X-Api-Key` غلط |

مثال `400`:

```json
{
  "status": "error",
  "message": "Type must be complaint or suggestion"
}
```

اعرضي `message` للمستخدم. قبل الإرسال قفلي الزر لو العنوان أو النص فاضي، ولو الطول تعدى الحد.

---

## شكل الشاشة

- حقل عنوان.
- اختيار واحد: شكوى (`complaint`) أو اقتراح (`suggestion`).
- حقل النص.
- زر إرسال.

متضيفيش حقل لاسم المرسل. الاسم والإيميل والدور بيتسجلوا من الحساب المسجّل الدخول.
