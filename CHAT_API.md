# Chat API (Mobile)

Base path: `/api/chat`  
Auth: `Authorization: Bearer <access_token>` on all routes  
Realtime: Socket.IO (same host), `auth: { token: <access_token> }`, user room `user_{userId}`

## Conversation types

| `type` | Participants | Who can start | Message limits |
|--------|--------------|---------------|----------------|
| `coach_athlete` | coach + athlete | Athlete → any coach; coach → athlete **with active subscription** | Athlete: 5 free messages unless subscription `active`. Coach: unlimited |
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
        "reason": "trial",
        "remainingMessages": 4
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
- `remainingMessages` is `null`
- `subscriptionStatus` / `isExpired` are unused (`null` / `false`)

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
- `attachments` (optional files, images/PDF, up to 10)

At least one of text or attachments is required.

**Athlete on `coach_athlete` only:** if free trial is exhausted → `403` with `code: "MESSAGE_LIMIT_REACHED"`.

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
2. **Coach↔athlete:** keep using `{ coachId }` / `{ athleteId }` as today; respect `chatPermission` for athletes.
3. **UI:** use `conversation.type` and `otherUser` for headers; do not assume every conversation has both `coachId` and `athleteId`.
4. **Unread badge:** `GET /chat/unread-count` and/or sum `unreadCount` on the list.
5. **Realtime:** on `chat:new_message`, append if the thread is open and refresh the conversation list.
