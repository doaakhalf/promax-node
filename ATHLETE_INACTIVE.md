# Athlete Inactive Status (Mobile)

Admin can set an athlete account to `inactive`.

While inactive:
- **Cannot** create a new subscription
- **Cannot** use coach ↔ athlete chat (start or send)
- **Can** keep using the rest of the app
- Existing subscriptions and payments are **unchanged**
- Admin ↔ athlete chat remains allowed

---

## How the app finds out

There is no Socket/FCM for this. Rely on:

1. **HTTP errors on subscribe / coach chat**

```json
{
  "status": "error",
  "code": "ATHLETE_INACTIVE",
  "message": "Account is inactive"
}
```

HTTP status: **403**

Handle in interceptor or locally on those screens: disable subscribe + coach chat UI.

2. **Login / profile `status`**  
   On launch/resume, if `status !== "active"` → hide subscribe and coach chat.

---

## Admin API

```http
PUT /api/athlete/:athleteId/change-status?status=inactive
PUT /api/athlete/:athleteId/change-status?status=active
Authorization: Bearer <admin token>
```

Deactivate does **not** change subscriptions or payments — only blocks new subscribe and coach↔athlete chat.
