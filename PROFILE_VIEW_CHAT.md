# Coach Profile View Chat (Mobile)

When an **athlete** opens a coach profile, the server opens a coach ↔ athlete chat if one does not exist yet.

See also [CHAT_API.md](./CHAT_API.md).

Base path: `/api/coaches`  
Auth: `Authorization: Bearer <access_token>`  
`:id` is the coach **user** id.

This runs only for `role === "athlete"`. Admin and coach callers get the success response with `conversationId: null` and no chat is created.

---

## `GET /api/coaches/open-chat-with-athlete/:id`

### Conversation already exists

Nothing new is sent. No message, no notification. The existing conversation id is returned.

### No conversation yet

The server creates a `coach_athlete` conversation and sends one message **from the coach**:

| Field | Value |
|--------|--------|
| `senderRole` | `"coach"` |
| `text` | `ازاي اقدر اساعدك؟` |
| `coachMessageCount` | `1` |

The athlete has not read it. The coach’s own read cursor is set, so the greeting is not unread for the coach.

A second request for the same pair does not create another conversation or send the greeting again.

---

## Notifications

Sent only on the **first** open (when the conversation is created).

### Athlete

Same shape as a normal chat push. `chat_message` is not listed in the in-app notification inbox.

| Field | Value |
|--------|--------|
| `type` | `"chat_message"` |
| `title` | Coach display name |
| `message` | `ازاي اقدر اساعدك؟` |
| `data.conversationId` | New conversation id |
| `data.messageId` | Greeting message id |

Socket event to the athlete room `user_{athleteId}`:

```json
{
  "message": {
    "id": "64f...",
    "conversationId": "64f...",
    "attachments": [],
    "text": "ازاي اقدر اساعدك؟",
    "senderId": "64f...",
    "senderRole": "coach",
    "createdAt": "2026-09-30T11:00:00.000Z"
  },
  "conversationId": "64f..."
}
```

Event name: `chat:new_message`.

### Coach

Shown in the notification inbox. Open the chat with `data.conversationId`.

| Field | Value |
|--------|--------|
| `type` | `"profile_view"` |
| `title` | `حد زار بروفايلك 😎` |
| `message` | `{athleteName} زار بروفايلك وتقدر تشوفه في الشات` |
| `data.conversationId` | New conversation id |

`athleteName` is the athlete display name (first name + last initial). If the name is empty, the message uses `متدرب`.

---

## Response

**200**

```json
{
  "status": "success",
  "message": "CHAT OPENED SUCCESSFULLY",
  "conversationId": "64f..."
}
```

`conversationId` is `null` when the caller is not an athlete, or when no conversation was opened.

**404** — coach user id does not match a coach.

```json
{
  "status": "error",
  "message": "Coach not found"
}
```

After a successful first open, load the thread with `GET /api/chat/conversations/:id` and `GET /api/chat/conversations/:id/messages`. The greeting is a normal coach message in that thread.
