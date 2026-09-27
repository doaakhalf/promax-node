# Google / Gmail Login (Mobile — Athletes)

Additive Google Sign-In for **athletes only**. Existing email/password login and register are unchanged.

| Existing (unchanged) | New |
|----------------------|-----|
| `POST /api/login` | `POST /api/auth/google` |
| `POST /api/register` | `POST /api/auth/google/complete` |

Coaches and admins cannot use Google Sign-In.

---

## Required header (every call)

See [CLIENT_API_KEY.md](./CLIENT_API_KEY.md).

```http
X-Api-Key: <CLIENT_API_KEY>
Content-Type: application/json
```

For `/auth/google/complete` with file uploads, use `multipart/form-data` instead of JSON (still send `X-Api-Key`).

---

## Rate limits

| Scope | Limit | Applies to |
|-------|-------|------------|
| All `/api/*` | **300** requests / 15 min per IP | Every API call |
| Auth routes | **20** requests / 15 min per IP | `/login`, `/register`, `/auth/google`, `/auth/google/complete`, password-reset |

On exceed → `429`:

```json
{
  "status": "error",
  "message": "Too many requests. Please try again later."
}
```

---

## Flow

```text
1. User taps "Continue with Google"
2. App gets Google idToken (native Google Sign-In)
3. POST /api/auth/google  { idToken }
4a. Existing athlete  → save token + refreshToken → home
4b. New user          → needsProfileCompletion: true
                      → show complete-profile screen (prefill email/name/photo)
                      → POST /api/auth/google/complete
                         (send googleSignupToken + same idToken + profile fields)
                      → save token + refreshToken → home
```

**Do not** create a session after step 3 when `needsProfileCompletion` is `true` — there is no access JWT yet.

`googleSignupToken` expires in about **15 minutes** (override with env `GOOGLE_SIGNUP_TOKEN_EXPIRES_IN`). If it expires, send the user back to Google Sign-In.

Keep the Google `idToken` until `/complete` succeeds — the complete step **re-verifies** it and checks it matches the signup token (`googleId` + `email`).

---

## 1) Check / login — `POST /api/auth/google`

### Request

```json
{
  "idToken": "<Google ID token from native Sign-In>"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `idToken` | yes | From Google Sign-In SDK (not access token). Email must be verified by Google. |

### Response — existing athlete (login)

Status `200`:

```json
{
  "message": "Login successful",
  "needsProfileCompletion": false,
  "token": "<access JWT>",
  "refreshToken": "<refresh JWT>",
  "expiresIn": 3600,
  "token_type": "Bearer",
  "status": "success",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "athlete",
    "profileImage": "...",
    "status": "active",
    "slug": "...",
    "shareProfileUrl": "..."
  }
}
```

Store `token` / `refreshToken` the same way as after `/api/login`.

If this Gmail already had a **local** athlete account (email/password), the server **links** Google, sets `authProvider: google`, and **invalidates** the old password. After that, only Google Sign-In works for this account.

### Response — new user (must complete profile)

Status `200`:

```json
{
  "needsProfileCompletion": true,
  "googleSignupToken": "<short-lived token ~15m>",
  "email": "user@gmail.com",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "profileImage": "https://lh3.googleusercontent.com/..."
}
```

UI tips:
- Prefill email / name / avatar from this response (read-only email recommended).
- Keep `googleSignupToken` **and** `idToken` in memory (or secure short-lived storage) until complete succeeds.
- Collect: gender, phone, date of birth, weight, height, training frequency (+ optional goals/injuries/files).

### Errors

| Status | When |
|--------|------|
| `422` | Missing `idToken` |
| `401` | Invalid / expired / wrong-audience Google token, or Google email not verified |
| `403` | Email belongs to coach or admin |
| `429` | Rate limit exceeded |
| `500` | Server Google / JWT config missing |

Example:

```json
{
  "status": "error",
  "message": "Google Sign-In is available for athletes only"
}
```

---

## 2) Complete signup — `POST /api/auth/google/complete`

Creates the athlete account, then returns JWT (this is the real first login).

### Body fields

| Field | Required | Notes |
|-------|----------|--------|
| `googleSignupToken` | yes | From step 1 new-user response |
| `idToken` | yes | Same Google ID token from Sign-In (re-verified on the server) |
| `gender` | yes | `male` \| `female` \| `other` |
| `phoneNumber` | yes | Egyptian mobile: `01[0125]` + 8 digits (11 total) |
| `dateOfBirth` | yes | `YYYY-MM-DD` or ISO 8601 |
| `weight` | yes | number |
| `height` | yes | number |
| `trainingFrequency` | yes | `"1"` … `"7"` |
| `goals` | no | string |
| `injuries` | no | string |
| `profileImage` | no | file (multipart) — overrides Google photo if sent |
| `inbodyFile` | no | file (multipart) |

Email, first/last name, and Google photo come from `googleSignupToken` — **do not** send email from the client as the source of truth. The live `idToken` must match the signup token identity.

### JSON example

```json
{
  "googleSignupToken": "...",
  "idToken": "<same Google ID token from Sign-In>",
  "gender": "female",
  "phoneNumber": "01012345678",
  "dateOfBirth": "1998-05-20",
  "weight": 65,
  "height": 165,
  "trainingFrequency": "3",
  "goals": "Lose weight",
  "injuries": null
}
```

### Multipart example (React Native style)

```js
const form = new FormData();
form.append("googleSignupToken", googleSignupToken);
form.append("idToken", idToken);
form.append("gender", "female");
form.append("phoneNumber", "01012345678");
form.append("dateOfBirth", "1998-05-20");
form.append("weight", "65");
form.append("height", "165");
form.append("trainingFrequency", "3");
// optional files:
// form.append("profileImage", { uri, name: "profile.jpg", type: "image/jpeg" });
// form.append("inbodyFile", { uri, name: "inbody.pdf", type: "application/pdf" });

await fetch(`${API_BASE}/api/auth/google/complete`, {
  method: "POST",
  headers: {
    "X-Api-Key": CLIENT_API_KEY,
    // do not set Content-Type manually for FormData
  },
  body: form,
});
```

### Success response

Status `201`:

```json
{
  "message": "Athlete registered successfully",
  "needsProfileCompletion": false,
  "token": "<access JWT>",
  "refreshToken": "<refresh JWT>",
  "expiresIn": 3600,
  "token_type": "Bearer",
  "userData": {
    "id": "...",
    "athleteName": "...",
    "email": "...",
    "phone": "01012345678",
    "profileImage": "...",
    "gender": "female",
    "weight": 65,
    "height": 165,
    "trainingFrequency": "3",
    "dateOfBirth": "1998-05-20",
    "goals": "...",
    "injuries": null
  }
}
```

Store tokens like after normal register/login. New Google accounts are created with `authProvider: google` (password login disabled).

### Errors

| Status | When |
|--------|------|
| `422` | Validation (phone, gender, missing fields including `idToken` / `googleSignupToken`, email or phone already exists) |
| `401` | Invalid/expired `googleSignupToken`, invalid Google `idToken`, unverified email, or identity mismatch → restart Google Sign-In |
| `429` | Rate limit exceeded |
| `500` | Server error |

```json
{
  "message": "Validation error",
  "errors": {
    "phoneNumber": "Phone number must be a valid Egyptian mobile number (11 digits)"
  }
}
```

```json
{
  "status": "error",
  "message": "Google signup token expired. Please sign in with Google again."
}
```

```json
{
  "status": "error",
  "message": "Google identity does not match signup token"
}
```

---

## Frontend decision tree

```text
onGoogleButtonPressed:
  idToken = await GoogleSignIn.getIdToken()
  res = POST /api/auth/google { idToken }

  if res.needsProfileCompletion === true:
      navigate to CompleteAthleteProfile
      prefill email, firstName, lastName, profileImage
      keep googleSignupToken AND idToken
      onSubmit → POST /api/auth/google/complete
                 { googleSignupToken, idToken, ...profile fields }
      on success → save tokens → home

  else:
      save res.token + res.refreshToken → home
```

Handle `429` with a short “try again later” message. On `401` for signup/complete, restart Google Sign-In (do not reuse stale tokens).

---

## Password login note

Accounts with `authProvider: google` **cannot** use email/password login.

```json
{
  "status": "error",
  "message": "This account uses Google Sign-In. Please continue with Gmail."
}
```

If the user already had an email/password athlete account and later signs in with the same Gmail, the server **links** Google, sets `authProvider: google`, and **rotates** the password hash so password login no longer works for that account. Use Google Sign-In going forward.

---

## What Google provides vs what the app collects

| From Google (idToken) | From complete-profile screen |
|------------------------|------------------------------|
| email (must be verified) | phoneNumber |
| firstName / lastName | gender |
| profile photo URL | dateOfBirth, weight, height, trainingFrequency |
| googleId (server only) | goals / injuries / files (optional) |

Phone number is **not** returned by normal Google Sign-In.

---

## Mobile setup checklist

1. Configure Google Sign-In (Android package + SHA-1, iOS Bundle ID).
2. Use the same OAuth **client IDs** the backend has in `GOOGLE_CLIENT_IDS` / `GOOGLE_CLIENT_ID`.
3. Send the **ID token** to the API (not the Google access token).
4. Keep existing `/api/login` and `/api/register` screens as they are; only add a Google button for athletes.
5. Refresh tokens: same as today — `POST /api/user/refresh` when access token expires.
6. On complete-profile, send both `googleSignupToken` and the same `idToken`.
7. Handle `429` (rate limit) and expired signup token (~15m).

---

## Server env (backend)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_IDS` | Comma-separated OAuth client IDs (iOS + Android + Web) |
| `JWT_SECRET` | Access JWT + `googleSignupToken` (required, no fallback) |
| `REFRESH_TOKEN_SECRET` | Refresh JWT (required, no fallback) |
| `GOOGLE_SIGNUP_TOKEN_EXPIRES_IN` | Optional; default `15m` |
| `CLIENT_API_KEY` | Required on every `/api` request |

---

## Quick test with Postman

1. Get a real `idToken` from the app (or a temporary Web OAuth client whose client ID is on the server allowlist).
2. `POST /api/auth/google` with `X-Api-Key` + `{ "idToken": "..." }`.
3. If `needsProfileCompletion`, call `/api/auth/google/complete` with `googleSignupToken`, the same `idToken`, and athlete fields.
4. Confirm `/api/login` rejects Google-linked accounts with the “continue with Gmail” message.
5. Confirm `/api/login` and `/api/register` still work for pure email/password users.
