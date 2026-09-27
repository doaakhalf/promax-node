# Client API Key (Frontend / Mobile)

Every request to `/api/*` must send a shared secret in a header. Without it the API returns `403`.

## Required header

| Name | Value |
|------|--------|
| `X-Api-Key` | Same value as server `CLIENT_API_KEY` (from `.env` / Railway) |

Alias (also accepted): `X-Client-Api-Key`

```http
X-Api-Key: <CLIENT_API_KEY>
```

Send the **full** key (no spaces, no quotes). A truncated key is rejected.

### Error response

```json
{
  "status": "error",
  "message": "Invalid or missing API key"
}
```

Status: `403`

---

## Website (trainifypro.com)

Attach the header on **every** API call (including login, register, uploads, and authenticated routes).

### fetch

```js
const CLIENT_API_KEY = import.meta.env.VITE_CLIENT_API_KEY;

fetch(`${API_BASE}/api/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": CLIENT_API_KEY,
  },
  body: JSON.stringify({ email, password }),
});
```

### axios

```js
import axios from "axios";

axios.defaults.baseURL = API_BASE;
axios.defaults.headers.common["X-Api-Key"] =
  import.meta.env.VITE_CLIENT_API_KEY;
```

### Prefer env on the site build

```env
# .env / Vercel / hosting
VITE_CLIENT_API_KEY=replace-with-your-client-api-key
# or NEXT_PUBLIC_CLIENT_API_KEY=...
```

```js
axios.defaults.headers.common["X-Api-Key"] =
  import.meta.env.VITE_CLIENT_API_KEY;
```

---

## Mobile app (React Native / Expo)

Same header on every HTTP request. Load from app config / env — do not hardcode production keys in source that ships publicly.

```js
axios.defaults.headers.common["X-Api-Key"] = process.env.EXPO_PUBLIC_CLIENT_API_KEY;
```

### Socket.IO

```js
io(API_BASE, {
  auth: {
    token: accessToken,
    apiKey: process.env.EXPO_PUBLIC_CLIENT_API_KEY,
  },
});
```

---

## Admin dashboard

Configured in:

- `admin-dashboard-angular/src/environments/environment.ts`
- `admin-dashboard-angular/src/environments/environment.prod.ts`

Field: `clientApiKey` — must match server `CLIENT_API_KEY`. Rebuild after changing it.

---

## Server (must match)

Local `.env` and Railway:

```env
CLIENT_API_KEY=replace-with-your-client-api-key
```

Restart the Node server after changing `.env`. In production, a missing key returns `503`.

### Apidog / Postman

1. Global Params → Headers → `X-Api-Key` = same value as server  
2. Base URL: local `http://localhost:3000` or Railway production URL  
3. If you change the key on the server, update Apidog and restart the server

---

## CORS (browsers only)

Allowed origins (via `CORS_ORIGINS` + `BASE_URL`):

- `https://trainifypro.com`
- `https://www.trainifypro.com`
- admin host (`BASE_URL`)

Native apps usually send **no** `Origin`; they are allowed only with a valid `X-Api-Key`.

---

## Checklist

1. Server `CLIENT_API_KEY` set (local + Railway)
2. Website / mobile / Apidog send the **same** full key
3. Admin `clientApiKey` matches; rebuild if changed
4. Request without header → `403`
5. Request with correct header → proceeds (may still need JWT → `401`)

## Notes

- This is a shared client secret, not a user password. It can still be extracted from an app/website binary — rotate if it leaks.
- Do not commit real production keys to the repo; use placeholders in docs and `.env.example`.
