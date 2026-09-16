# Chat seen / read receipts (Mobile)

WhatsApp-style blue ticks for outgoing messages.  
Base path: `/api/chat` · Auth: `Authorization: Bearer <access_token>`  
Realtime: Socket.IO with `auth: { token: <access_token> }`

This doc covers **only** seen/read receipts. Other chat APIs stay in `CHAT_API.md`.

---

## Blue-tick rule

For messages **you** sent:

| Condition | UI |
|-----------|-----|
| `message.createdAt <= peerLastReadAt` | **Seen** (blue ticks) |
| otherwise / `peerLastReadAt` is `null` | **Sent** (grey tick) |

Incoming messages: no ticks.

There is **no** per-message `isSeen` field. One conversation timestamp drives all ticks.

---

## Field: `peerLastReadAt`

ISO timestamp when the **other** participant last read this conversation, or `null`.

Returned on:

- Conversation objects (`GET /conversations`, `GET /conversations/:id`, and nested `conversation` after send)
- Message list: `GET /conversations/:id/messages`

**Example (conversation)**

```json
{
  "id": "...",
  "unreadCount": 0,
  "peerLastReadAt": "2026-09-10T08:15:00.000Z",
  "otherUser": { "...": "..." }
}
```

**Example (messages)**

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
      "createdAt": "2026-09-10T08:10:00.000Z"
    }
  ],
  "peerLastReadAt": "2026-09-10T08:15:00.000Z"
}
```

Opening the thread via `GET .../messages` marks **you** as having read (and notifies the peer — see socket below).

---

## Endpoint: `PUT /api/chat/conversations/:id/read`

Mark the conversation as read **without** fetching messages.

Use when the user is **already** in the open chat and receives a new inbound `chat:new_message`.

**Response** `200`

```json
{
  "status": "success",
  "conversationId": "...",
  "readAt": "2026-09-10T08:20:00.000Z"
}
```

Also notifies the peer via `chat:messages_read`.

---

## Socket: `chat:messages_read`

Emitted to the **other** user when someone marks the conversation read (`GET .../messages` or `PUT .../read`).

```json
{
  "conversationId": "...",
  "readAt": "2026-09-10T08:20:00.000Z",
  "readerId": "..."
}
```

**Client handling**

1. If `conversationId` matches the open (or listed) thread, set local `peerLastReadAt = readAt`.
2. Recompute blue ticks for your outgoing messages: `createdAt <= peerLastReadAt`.

---

## When to mark read

| Situation | Action |
|-----------|--------|
| User opens a chat thread | `GET /conversations/:id/messages` (already marks read) |
| User already in chat + new inbound message | `PUT /conversations/:id/read` |
| User sends a message | Server clears **your** unread; no peer notify |

Admin read-only revision routes do **not** mark read or emit receipts.
