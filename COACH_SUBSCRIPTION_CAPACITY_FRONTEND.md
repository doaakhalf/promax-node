# Coach Subscription Capacity (Mobile)

Admin-configurable cap on how many **active + pending** subscriptions a coach may hold at once.  
Default if admin never set a value: **5**.

---

## Fields on coach payloads (athlete views)

Returned on:

- Coach list: `GET /api/coaches` / `GET /api/coaches/with-subscription` (`CoachResourceForAthelete`)
- Coach profile when viewer is an athlete: `GET /api/coaches/my-profile/:id`

```json
{
  "canSubscribe": true,
  "maxActiveSubscriptions": 5,
  "activeSubscriptionCount": 3,
  "subscriptionStatus": null,
  "paymentStatus": null
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `canSubscribe` | `boolean` | Athlete may create a **new** subscription request now |
| `maxActiveSubscriptions` | `number` | Admin-configured cap per coach |
| `activeSubscriptionCount` | `number` | Current occupied slots (`active` + `pending`, not soft-deleted) |

### When `canSubscribe` is `false`

- Coach is at capacity (`activeSubscriptionCount >= maxActiveSubscriptions`), **or**
- Viewer already has an `active` / `pending` subscription with this coach (`subscriptionStatus` will be set)

Prefer server values over hardcoding `5` — admin can change the limit anytime.

---

## UI suggestions

```text
Slots: activeSubscriptionCount / maxActiveSubscriptions
```

- `canSubscribe == true` → enable Subscribe CTA
- `canSubscribe == false` and `subscriptionStatus == null` → show “full” / waitlist style message
- `subscriptionStatus` is `active` or `pending` → show existing subscription state (not the capacity message)

---

## Subscribe blocked — `403`

`POST /api/athlete/subscribe/:coachId` when the coach is at capacity:

```json
{
  "status": "error",
  "code": "COACH_SUBSCRIPTION_LIMIT_REACHED",
  "message": "This coach has reached the maximum number of active subscriptions",
  "maxActiveSubscriptions": 5,
  "activeSubscriptionCount": 5
}
```

Disable the Subscribe button when `canSubscribe` is false to avoid this error; still handle `COACH_SUBSCRIPTION_LIMIT_REACHED` if the list was stale.

---

## Admin

| Endpoint | Body |
|----------|------|
| `GET /api/admin/subscription/settings` | — |
| `PUT /api/admin/subscription/settings` | `{ "maxActiveSubscriptionsPerCoach": 5 }` |

Also editable under **Settings → Coach subscription capacity** in the admin dashboard.
