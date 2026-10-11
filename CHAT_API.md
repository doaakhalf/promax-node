# Chat API (Mobile)

Base path: `/api/chat`  
Auth: `Authorization: Bearer <access_token>` on all routes  
Realtime: Socket.IO (same host), `auth: { token: <access_token> }`, user room `user_{userId}`

## Conversation types

| `type` | Participants | Who can start | Message limits |
|--------|--------------|---------------|----------------|
| `coach_athlete` | coach + athlete | Athlete → any coach; coach → athlete **with active subscription** | Athlete **and** coach: free-trial messages each (own counter, admin-configurable, default **25**) unless subscription `active` |
| `admin_coach` | admin + coach | Either side | Unlimited |
| `admin_athlete` | admin + athlete | Either side | Unlimited |

Existing coach↔athlete business rules are unchanged. Admin chats are additive.

---

## Endpoints

### `GET /api/chat/admins`

List admins (for coach/athlete “message support” pickers).

**Response**

```json
{
  "admins": [
    {
      "id": "64f...",
      "name": "Support Admin",
      "profilePhoto": "images/..."
    }
  ]
}
```

---

### `GET /api/chat/conversations`

Lists the caller’s conversations that already have at least one message.

**Response**

```json
{
  "conversations": [
    {
      "id": "...",
      "type": "coach_athlete",
      "adminId": null,
      "coachId": "...",
      "athleteId": "...",
      "otherUser": {
        "id": "...",
        "name": "Jane D.",
        "profilePhoto": null,
        "isOnline": false
      },
      "lastMessage": {
        "text": "Hello",
        "createdAt": "2026-09-07T08:00:00.000Z",
        "senderRole": "athlete"
      },
      "unreadCount": 1,
      "chatPermission": {
        "canSend": true,
        "canSendMedia": false,
        "reason": "trial",
        "remainingMessages": 22,
        "freeTrialMessageLimit": 25
      },
      "isExpired": false,
      "expiredAt": null,
      "startedAt": "2026-09-01T10:00:00.000Z",
      "subscriptionStatus": "pending"
    }
  ]
}
```

Admin chat example (`type`: `admin_coach` or `admin_athlete`):

- `chatPermission.reason` is `"admin"`
- `chatPermission.canSendMedia` is `true` (voice and video are allowed)
- `remainingMessages` is `null`
- `freeTrialMessageLimit` is `null`
- `subscriptionStatus` / `isExpired` are unused (`null` / `false`)

For athlete free-trial UI (`remainingMessages` / `freeTrialMessageLimit`), see [CHAT_FREE_TRIAL_LIMIT.md](./CHAT_FREE_TRIAL_LIMIT.md).

---

### `POST /api/chat/conversations`

Find or create a 1:1 conversation.

#### Athlete

| Body | Result |
|------|--------|
| `{ "coachId": "<userId>" }` | `coach_athlete` (existing) |
| `{ "adminId": "<userId>" }` | `admin_athlete` |

#### Coach

| Body | Result |
|------|--------|
| `{ "athleteId": "<userId>" }` | `coach_athlete` (requires **active** subscription) |
| `{ "adminId": "<userId>" }` | `admin_coach` |

#### Admin

| Body | Result |
|------|--------|
| `{ "coachId": "<userId>" }` | `admin_coach` |
| `{ "athleteId": "<userId>" }` | `admin_athlete` |

Do not send both `coachId` and `athleteId` as admin.

**Response** `200` (existing) or `201` (created):

```json
{
  "conversation": { "...same shape as list item..." }
}
```

---

### `GET /api/chat/conversations/:id`

Conversation metadata for a participant. Same payload as a list item (not wrapped).

---

### `GET /api/chat/conversations/:id/messages?page=1&limit=50`

Paginated messages (oldest → newest in the returned page). Marks the conversation as read for the caller.

```json
{
  "messages": [
    {
      "id": "...",
      "conversationId": "...",
      "text": "Hello",
      "attachments": [],
      "replyTo": null,
      "senderId": "...",
      "senderRole": "athlete",
      "createdAt": "2026-09-07T08:00:00.000Z"
    }
  ]
}
```

`senderRole`: `"athlete" | "coach" | "admin"`

---

### `POST /api/chat/conversations/:id/messages`

`multipart/form-data`:

- `text` (optional string)
- `attachments` (optional files, up to 10)
- `replyTo` (optional message id in this same conversation)

When `replyTo` is set, the saved message includes a snapshot of that message. A missing or foreign id returns `400` with `"Reply target not found"`. Omit the field for a normal message.

```json
"replyTo": {
  "id": "...",
  "senderRole": "coach",
  "text": "Hello"
}
```

`replyTo.text` is the original text, or an attachment preview (`Photo`, `Voice message`, `Video`, `Attachment`) when that message has no text. `replyTo` is `null` when the message is not a reply.

Attachment types:

| Kind | Extensions | Max size | Who can send |
|------|------------|----------|----------------|
| image | any `image/*` | 50 MB | Anyone who can send a message |
| pdf | `.pdf` | 50 MB | Anyone who can send a message |
| audio | `.mp3` `.m4a` `.aac` `.wav` `.ogg` `.webm` (and `.mp4` when the MIME type is audio) | 15 MB | `admin_coach` / `admin_athlete` always; `coach_athlete` only when subscription is `active` |
| video | `.mp4` `.mov` `.webm` `.3gp` | 50 MB | Same as audio |

At least one of text or attachments is required.

`attachments[].type` is `"image" | "pdf" | "audio" | "video"`.

**Athlete or coach on `coach_athlete`:** if that side’s free trial is exhausted → `403` with `code: "MESSAGE_LIMIT_REACHED"`. Each side has its own counter.

**Voice or video on `coach_athlete` without an active subscription** → `403`:

```json
{
  "status": "error",
  "code": "MEDIA_REQUIRES_SUBSCRIPTION",
  "message": "Voice and video require an active subscription"
}
```

Use `chatPermission.canSendMedia` to show or hide the voice/video controls. It is `true` when `reason` is `"active"` or `"admin"`, and `false` during the free trial.

**Response** `201`:

```json
{
  "message": { "...serialized message..." },
  "conversation": { "...updated conversation for sender..." }
}
```

Also emits Socket.IO `chat:new_message` to the peer and sends a `chat_message` push/notification when configured.

---

### `GET /api/chat/unread-count`

```json
{
  "status": "success",
  "unreadCount": 3
}
```

Includes coach↔athlete and admin conversations.

---

## Socket.IO

Connect with the access token:

```js
io(API_HOST, { auth: { token: accessToken } });
```

### Server → client

**`chat:new_message`**

```json
{
  "conversationId": "...",
  "message": {
    "id": "...",
    "conversationId": "...",
    "text": "...",
    "attachments": [],
    "replyTo": null,
    "senderId": "...",
    "senderRole": "admin",
    "createdAt": "..."
  }
}
```

**`chat:typing`**

```json
{
  "conversationId": "...",
  "userId": "...",
  "isTyping": true
}
```

### Client → server

**`chat:typing`**

```json
{ "conversationId": "...", "isTyping": true }
```

Only participants of that conversation may emit; the server relays to the peer.

---

## Mobile integration notes

1. **Message admin:** call `GET /chat/admins`, then `POST /chat/conversations` with `{ adminId }`.
2. **Coach↔athlete:** keep using `{ coachId }` / `{ athleteId }` as today; respect `chatPermission` for **both** athlete and coach (see [CHAT_FREE_TRIAL_LIMIT.md](./CHAT_FREE_TRIAL_LIMIT.md)).
3. **UI:** use `conversation.type` and `otherUser` for headers; do not assume every conversation has both `coachId` and `athleteId`.
4. **Unread badge:** `GET /chat/unread-count` and/or sum `unreadCount` on the list.
5. **Realtime:** on `chat:new_message`, append if the thread is open and refresh the conversation list.
