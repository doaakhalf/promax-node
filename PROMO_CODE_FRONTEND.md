# Promo Codes — Frontend / Mobile API Guide

## Overview

Promo codes can be created by **coaches** (discount from coach price) or **admin** (discount from platform fee).  
Athletes may optionally send a code when subscribing.

| Who | What they do | Discount comes from |
|-----|----------------|---------------------|
| Coach | Creates code for their own subscriptions | Coach net (`coachNetAmount`) |
| Admin | Creates platform-wide code | Platform fee (`platformFee`), capped by `PERCENTAGE` |
| Athlete | Optional field on subscribe | Applied server-side after validation |

---

## Auth

All endpoints below require:

- `Authorization: Bearer <token>`
- Role as noted
- Same client headers you already use (`X-Api-Key` if required)

---

## 1) Coach — create / manage promo codes

Mobile (coach app) owns the form. Coach enters **discount %** (and optional expiry / usage limit).  
**Server generates the full code** — coach must not invent the string.

### Create

`POST /api/coaches/promo-codes`  
Role: `coach`  
`Content-Type: application/json`

**Body**

```json
{
  "discountPercent": 15,
  "expiresAt": "2026-10-20T00:00:00.000Z",
  "usageLimit": 50
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `discountPercent` | yes | Integer `1..100` |
| `expiresAt` | no | Default = **now + 30 days** if omitted. Must be a future date if sent |
| `usageLimit` | no | Max successful uses. Omit / `null` = unlimited |

**Success `201`**

```json
{
  "message": "Promo code created successfully",
  "data": {
    "id": "...",
    "code": "AHMED-15-K7X2",
    "source": "coach",
    "coachId": "...",
    "discountPercent": 15,
    "expiresAt": "2026-10-20T00:00:00.000Z",
    "usageLimit": 50,
    "usedCount": 0,
    "isActive": true,
    "createdAt": "..."
  }
}
```

**UI tip:** Show `code` large + Copy button. Coach shares this exact string with athletes.

Code format: `{CoachFirstName}-{discount}-{randomSuffix}`  
Examples:
- English: `AHMED-15-K7X2`
- Arabic: `أحمد-15-K7X2`

The name part uses the coach’s **first name** as stored (Arabic is kept as-is). Suffix is always Latin alphanumeric.

---

### List my codes

`GET /api/coaches/promo-codes`  
Role: `coach`

**Success `200`**

```json
{
  "message": "success",
  "data": [
    {
      "id": "...",
      "code": "AHMED-15-K7X2",
      "discountPercent": 15,
      "expiresAt": "...",
      "usageLimit": 50,
      "usedCount": 3,
      "isActive": true
    }
  ]
}
```

---

### Deactivate / update

`PATCH /api/coaches/promo-codes/:id`  
Role: `coach` (own codes only)

```json
{
  "isActive": false,
  "expiresAt": "2026-11-01T00:00:00.000Z",
  "usageLimit": 100
}
```

Note: `code` and `discountPercent` are **not** editable after create.

`DELETE /api/coaches/promo-codes/:id` — soft deactivate.

---

## 2) Athlete — apply on subscribe

### Subscribe (with optional promo)

`POST /api/athlete/subscribe/:coachId`  
Role: `athlete`  
`Content-Type: multipart/form-data` (same as today)

| Field | Required | Notes |
|-------|----------|--------|
| `paymentImage` | yes | Receipt image (existing) |
| `subscriptionPlan` | no | default `monthly` |
| `paymentMethod` | no | `instapay` \| `wallet` \| `bank` |
| `transactionId` | no | |
| `promoCode` | no | Exact code string. Also accept `promocode` |

**Behavior**

- No `promoCode` → full price (current behavior).
- Valid code → discounted amounts returned and stored on subscription.
- Invalid / expired / inactive / wrong coach / usage exceeded → **`400`** (do not ignore silently).

**Success `201` (extra promo fields)**

```json
{
  "message": "Subscription created successfully",
  "subscription": {
    "id": "...",
    "coachId": "...",
    "amount": 950,
    "platformFee": 100,
    "coachNetAmount": 850,
    "promoCode": "AHMED-15-K7X2",
    "promoSource": "coach",
    "promoDiscountPercent": 15,
    "promoDiscountAmount": 150,
    "paymentStatus": "pending",
    "status": "pending"
  }
}
```

### Money rules (for UI copy)

Base: `amount = coachNet + platformFee`

| Code source | Effect |
|-------------|--------|
| `coach` | Reduces **coach net** only; platform fee unchanged |
| `admin` | Reduces **platform fee** only (cannot go below 0) |

Example coach price `1000`, platform `10%` → fee `100`, total `1100`:

- Coach promo `15%` → net `850`, fee `100`, pay **`950`**
- Admin promo `5%` → net `1000`, fee `50`, pay **`1050`**

Show the athlete the **final `amount`** to pay via Instapay.

---

### Preview before pay (recommended)

`POST /api/athlete/subscribe/:coachId/preview-promo`  
Role: `athlete`  
`Content-Type: application/json` or multipart text fields

```json
{
  "promoCode": "AHMED-15-K7X2"
}
```

**Success `200`**

```json
{
  "message": "success",
  "data": {
    "amount": 950,
    "platformFee": 100,
    "coachNetAmount": 850,
    "promoCode": "AHMED-15-K7X2",
    "promoSource": "coach",
    "promoDiscountPercent": 15,
    "promoDiscountAmount": 150
  }
}
```

Call this when the user taps “Apply” before uploading the receipt.

---

## 3) Admin (dashboard)

Admin uses the Angular **Promo codes** page (`/promo-codes`).

APIs:

- `POST /api/admin/promo-codes`
- `GET /api/admin/promo-codes?source=admin|coach`
- `PATCH /api/admin/promo-codes/:id`
- `DELETE /api/admin/promo-codes/:id`

Admin discount **cannot exceed** platform `PERCENTAGE` (e.g. if fee is 10%, max admin promo is `10`).

If `code` omitted on create, server generates `ADMIN-{discount}-{suffix}`.

---

## Error handling (mobile)

| Status | When | UI |
|--------|------|-----|
| `400` | Bad/expired/inactive/wrong-coach/usage limit | Show `message` under promo field |
| `404` | Coach not found on subscribe | Existing handling |
| `401/403` | Auth/role | Existing handling |

Always use the **exact** `code` returned from create (case-insensitive on server, but send as returned).

---

## Suggested mobile screens

### Coach

1. Form: discount %, date picker (prefilled +30 days), optional usage limit  
2. Submit → show generated code + copy/share  
3. List of my codes (active / expired / used count) + deactivate

### Athlete (subscribe)

1. Existing payment flow  
2. Optional “Promo code” input + Apply → call **preview**  
3. Update displayed total to preview `amount`  
4. On subscribe, send same `promoCode` with multipart body  

---

## Notes for QA

- Coach code of coach A must fail when subscribing to coach B.  
- Expired `expiresAt` → `400`.  
- Missing promo → still succeeds at full price.  
- Wrong guessed format without real suffix → `400`.  
