# Chat Free Trial Message Limit (Mobile)

Admin-configurable free-trial cap for **coach ↔ athlete** chats (`type: "coach_athlete"`).  
The limit is returned on every conversation payload inside `chatPermission` — no extra API call.

See also [CHAT_API.md](./CHAT_API.md).

---

## Who is limited

| Role / chat type | Limited? |
|------------------|----------|
| Athlete on `coach_athlete` (subscription not `active`) | Yes — own counter (`athleteMessageCount`) |
| Coach on `coach_athlete` (subscription not `active`) | Yes — own counter (`coachMessageCount`) |
| Either side when subscription is `active` | No — unlimited |
| `admin_coach` / `admin_athlete` | No — unlimited |

Each side has a **separate** quota of `freeTrialMessageLimit` messages. One side hitting the limit does **not** block the other.

---

## Field: `chatPermission`

Returned on list / get / create conversation responses (and on the conversation object after send).  
Values are always from the **viewer's** perspective (their own remaining count).

```json
{
  "chatPermission": {
    "canSend": true,
    "canSendMedia": false,
    "reason": "trial",
    "remainingMessages": 22,
    "freeTrialMessageLimit": 25
  }
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `canSend` | `boolean` | Whether the **viewer** may send right now |
| `canSendMedia` | `boolean` | Whether the viewer may send **voice or video**. `true` only when `reason` is `"active"` or `"admin"` |
| `reason` | `string` | See table below |
| `remainingMessages` | `number \| null` | Messages left in **this viewer's** trial; `null` = unlimited |
| `freeTrialMessageLimit` | `number \| null` | Total trial cap per side (admin-configured); `null` = unlimited |

### `reason` values

| `reason` | `canSend` | `canSendMedia` | `remainingMessages` | `freeTrialMessageLimit` |
|----------|-----------|----------------|---------------------|-------------------------|
| `"trial"` | `true` | `false` | `> 0` | e.g. `25` |
| `"limit_reached"` | `false` | `false` | `0` | e.g. `25` |
| `"active"` | `true` | `true` | `null` | `null` |
| `"admin"` | `true` | `true` | `null` | `null` |
| `"account_inactive"` | `false` | `false` | `null` | `null` |
| `"admin_blocked"` | `false` | `false` | `null` | `null` |

Default limit if admin has never set one: **25** (per side).

---

## UI suggestions

```text
Used = freeTrialMessageLimit - remainingMessages
Show:  "3 / 25"  or  "22 messages left"
```

- When `freeTrialMessageLimit == null` → hide the counter (unlimited).
- When `reason == "limit_reached"` → disable composer; show upgrade / renew CTA.
- When `canSendMedia == false` → hide voice and video controls. Text, images, and PDF still follow `canSend`.
- Prefer server values over hardcoding `25` — admin can change the limit anytime; next conversation fetch reflects the new value.
- Athlete and coach UIs each show **their own** remaining — do not share one counter in the UI.

---

## Send blocked — `403`

`POST /api/chat/conversations/:id/messages` (athlete **or** coach, own trial exhausted):

```json
{
  "status": "error",
  "code": "MESSAGE_LIMIT_REACHED",
  "message": "Free message limit reached"
}
```

Handle the same as `chatPermission.reason === "limit_reached"`.

Voice or video on `coach_athlete` while the subscription is not `active`:

```json
{
  "status": "error",
  "code": "MEDIA_REQUIRES_SUBSCRIPTION",
  "message": "Voice and video require an active subscription"
}
```

Admin chats (`admin_coach`, `admin_athlete`) can send voice and video with no subscription.

---

## Examples

### Trial (can still send) — viewer has 22 left of 25

```json
{
  "type": "coach_athlete",
  "subscriptionStatus": "pending",
  "chatPermission": {
    "canSend": true,
    "canSendMedia": false,
    "reason": "trial",
    "remainingMessages": 22,
    "freeTrialMessageLimit": 25
  }
}
```

### Trial exhausted — this viewer only

```json
{
  "type": "coach_athlete",
  "subscriptionStatus": "expired",
  "chatPermission": {
    "canSend": false,
    "canSendMedia": false,
    "reason": "limit_reached",
    "remainingMessages": 0,
    "freeTrialMessageLimit": 25
  }
}
```

The other participant may still send if their own counter has remaining messages.

### Active subscription (unlimited)

```json
{
  "type": "coach_athlete",
  "subscriptionStatus": "active",
  "chatPermission": {
    "canSend": true,
    "canSendMedia": true,
    "reason": "active",
    "remainingMessages": null,
    "freeTrialMessageLimit": null
  }
}
```

### Admin chat (unlimited)

```json
{
  "type": "admin_athlete",
  "chatPermission": {
    "canSend": true,
    "canSendMedia": true,
    "reason": "admin",
    "remainingMessages": null,
    "freeTrialMessageLimit": null
  }
}
```
