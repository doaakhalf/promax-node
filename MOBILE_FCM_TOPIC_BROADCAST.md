# Mobile: FCM topic `guests` (guests + logged-out)

Admin broadcasts go to the Firebase topic **`guests`**.  
That topic means any device **without an active session**: first-time guests **and** users who logged out.  
Logged-in users must be unsubscribed. Personal notifications still use `POST /api/notifications/register-token` after login.

## Required app changes

| Event | Action |
|--------|--------|
| First launch / no session | `subscribeToTopic('guests')` |
| After successful login or signup | `unsubscribeFromTopic('guests')` + register token |
| After **logout** | `subscribeToTopic('guests')` again |
| While logged in | Stay unsubscribed → do not receive this broadcast |

### Code sketch

1. **On first launch (before login / signup)**  
   - Request notification permission.  
   - Initialize Firebase Messaging.  
   - Subscribe:

   ```dart
   await FirebaseMessaging.instance.subscribeToTopic('guests');
   ```

2. **Right after successful login OR signup**  

   ```dart
   await FirebaseMessaging.instance.unsubscribeFromTopic('guests');
   ```

   Keep existing token registration:

   `POST /api/notifications/register-token`  
   Body: `{ token, deviceId?, platform }`

3. **On logout**  
   Re-subscribe so logged-out users receive campaigns again:

   ```dart
   await FirebaseMessaging.instance.subscribeToTopic('guests');
   ```

4. **Release**  
   Ship an app update. Installs without this subscribe flow will not receive broadcasts correctly.

## Admin API (reference)

```
POST /api/admin/notifications/broadcast
Authorization: Bearer <admin_token>
{ "title": "...", "message": "...", "topic": "guests" }
```

## Smoke test

1. Fresh install, **no account** → subscribed → receives broadcast.  
2. After login/signup → unsubscribed → does **not** receive broadcast.  
3. After **logout** → subscribed again → receives broadcast.  
4. Logged-in user still receives personal pushes via `register-token` / `fcmTokens`.
