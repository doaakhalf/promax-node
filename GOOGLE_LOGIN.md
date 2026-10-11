# Google / Gmail Login (Mobile — Athletes and Coaches)

Google Sign-In is the registration path for **athletes and coaches**. Email/password registration is closed. Email/password **login** stays available for accounts that were created before this change.

| Endpoint | Role |
|----------|------|
| `POST /api/login` | Existing email/password accounts only |
| `POST /api/register` | Rejected (`403`). Use Google or Apple |
| `POST /api/auth/google` | Check / login |
| `POST /api/auth/google/complete` | Finish a new athlete or coach profile |

Admins cannot use Google Sign-In.

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
| Auth routes | **20** requests / 15 min per IP | `/login`, `/register`, `/auth/google`, `/auth/google/complete`, Apple auth, password-reset |

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
1. User taps "Continue with Google" on the athlete or coach signup screen
2. App gets Google idToken (native Google Sign-In)
3. POST /api/auth/google  { idToken, user_type }
4a. Existing coach or athlete → save token + refreshToken → home for that role
4b. New user → needsProfileCompletion: true
             → show the form for userType (prefill email / name / photo)
             → POST /api/auth/google/complete
                (googleSignupToken + same idToken + remaining profile fields)
             → save token + refreshToken
             → athlete: home
             → coach: pending approval
```

**Do not** create a session after step 3 when `needsProfileCompletion` is `true` — there is no access JWT yet.

`googleSignupToken` expires in about **15 minutes** (override with env `GOOGLE_SIGNUP_TOKEN_EXPIRES_IN`). If it expires, send the user back to Google Sign-In.

Keep the Google `idToken` until `/complete` succeeds — the complete step **re-verifies** it and checks it matches the signup token (`googleId` + `email`).

The role is stored in `googleSignupToken`. The complete call does not accept a different `user_type`.

Coach apps must send `user_type: "coach"`. If `user_type` is omitted, the server treats a **new** user as `athlete`.

---

## 1) Check / login — `POST /api/auth/google`

### Request

```json
{
  "idToken": "<Google ID token from native Sign-In>",
  "user_type": "coach"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `idToken` | yes | From Google Sign-In SDK (not access token). Email must be verified by Google. |
| `user_type` | no | `coach` or `athlete`. Default `athlete`. Used only when the account does not exist yet. |

### Response — existing coach or athlete (login)

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
    "role": "coach",
    "profileImage": "...",
    "status": "pending",
    "slug": "...",
    "shareProfileUrl": "..."
  }
}
```

`user.role` is the real account role (`athlete` or `coach`), even if the request sent a different `user_type`.

Store `token` / `refreshToken` the same way as after `/api/login`.

If this Gmail already had a **local** account (email/password), the server **links** Google, sets `authProvider: google`, and **invalidates** the old password. After that, only Google Sign-In works for this account.

### Response — new user (must complete profile)

Status `200`:

```json
{
  "needsProfileCompletion": true,
  "googleSignupToken": "<short-lived token ~15m>",
  "email": "user@gmail.com",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "profileImage": "https://lh3.googleusercontent.com/...",
  "userType": "coach"
}
```

UI tips:
- Prefill email / name / avatar from this response (read-only email).
- Keep `googleSignupToken` **and** `idToken` until complete succeeds.
- `userType: "athlete"` → collect athlete fields.
- `userType: "coach"` → collect coach fields. The account is created as `pending`.

### Errors

| Status | When |
|--------|------|
| `422` | Missing `idToken`, or `user_type` is not `coach` / `athlete` |
| `401` | Invalid / expired / wrong-audience Google token, or Google email not verified |
| `403` | Email belongs to an admin (or any role other than athlete/coach) |
| `429` | Rate limit exceeded |
| `500` | Server Google / JWT config missing |

```json
{
  "status": "error",
  "message": "Google Sign-In is available for athletes and coaches only"
}
```

---

## 2) Complete signup — `POST /api/auth/google/complete`

Creates the account for the role inside `googleSignupToken`, then returns a JWT.

### Shared fields

| Field | Required | Notes |
|-------|----------|--------|
| `googleSignupToken` | yes | From step 1 new-user response |
| `idToken` | yes | Same Google ID token (re-verified on the server) |

Email comes from the signup token. Do not send email as the source of truth. The live `idToken` must match that identity.

Name and Google photo also come from the token. Send `firstName` / `lastName` only when step 1 returned them empty. A `profileImage` file overrides the Google photo.

### Athlete fields (`userType: "athlete"`)

| Field | Required | Notes |
|-------|----------|--------|
| `gender` | yes | `male` \| `female` \| `other` |
| `phoneNumber` | yes | Egyptian mobile: `01[0125]` + 8 digits |
| `dateOfBirth` | yes | `YYYY-MM-DD` or ISO 8601 |
| `weight` | yes | number |
| `height` | yes | number |
| `trainingFrequency` | yes | `"1"` … `"7"` |
| `goals` | no | string |
| `injuries` | no | string |
| `profileImage` | no | file — overrides Google photo |
| `inbodyFile` | no | file |

New athletes are `active`.

### Coach fields (`userType: "coach"`)

| Field | Required | Notes |
|-------|----------|--------|
| `gender` | yes | `male` \| `female` \| `other` |
| `phoneNumber` | yes | Egyptian mobile |
| `type` | yes | `normal` \| `gym` |
| `monthlyPriceEgp` | yes | number ≥ 0 |
| `instapayLink` | one of | Valid Instapay URL, or send `walletNumber` |
| `walletNumber` | one of | Egyptian mobile, or send `instapayLink` |
| `sport` | yes | string |
| `headline` | yes | string |
| `motivation` | yes | string |
| `trainingExperience` | yes | string |
| `yearOfExperience` | yes | number ≥ 0 |
| `firstName` / `lastName` | if missing from Google | Otherwise the token name is used |
| `introduction` | no | string |
| `videoUrl` | no | string |
| `profileImage` | no | file — overrides Google photo |
| `certificates` | no | JSON + files, same as the old coach register |
| `achievements` | no | JSON + files |
| `galleryImages` | no | files |

New coaches are `pending` until an admin approves them.

### Coach JSON example

```json
{
  "googleSignupToken": "...",
  "idToken": "<same Google ID token from Sign-In>",
  "gender": "male",
  "phoneNumber": "01012345678",
  "type": "normal",
  "monthlyPriceEgp": 1500,
  "walletNumber": "01012345678",
  "sport": "Football",
  "headline": "Strength coach",
  "motivation": "Build consistent athletes",
  "trainingExperience": "Club and private sessions",
  "yearOfExperience": 6
}
```

### Success — athlete

Status `201`. `userData` is the athlete resource. `needsProfileCompletion` is `false`.

### Success — coach

Status `201`:

```json
{
  "message": "Coach registered successfully. Awaiting admin approval.",
  "needsProfileCompletion": false,
  "token": "<access JWT>",
  "refreshToken": "<refresh JWT>",
  "expiresIn": 3600,
  "token_type": "Bearer",
  "userData": {
    "status": "pending",
    "role": "coach"
  }
}
```

Store tokens like after login. New Google accounts use `authProvider: google` (password login disabled).

### Errors

| Status | When |
|--------|------|
| `422` | Validation, or email / phone already exists |
| `401` | Invalid/expired `googleSignupToken`, invalid Google `idToken`, or identity mismatch → restart Google Sign-In |
| `429` | Rate limit exceeded |
| `500` | Server error |

---

## Frontend decision tree

```text
onGoogleButtonPressed(userType):  // "athlete" or "coach"
  idToken = await GoogleSignIn.getIdToken()
  res = POST /api/auth/google { idToken, user_type: userType }

  if res.needsProfileCompletion === true:
      if res.userType === "coach":
          navigate to CompleteCoachProfile
      else:
          navigate to CompleteAthleteProfile
      prefill email, firstName, lastName, profileImage
      keep googleSignupToken AND idToken
      onSubmit → POST /api/auth/google/complete
      on success → save tokens
                   coach with status pending → waiting screen
                   athlete → home

  else:
      save res.token + res.refreshToken
      route by res.user.role
```

On `401` for signup/complete, restart Google Sign-In.

---

## Password login note

Accounts with `authProvider: google` cannot use email/password login.

```json
{
  "status": "error",
  "message": "This account uses Google Sign-In. Please continue with Gmail."
}
```

`POST /api/register` always returns:

```json
{
  "status": "error",
  "message": "Registration is only available with Google or Apple"
}
```

`POST /api/login` still works for older local accounts that have not been linked to Google or Apple.

---

## What Google provides vs what the app collects

| From Google | Athlete screen | Coach screen |
|-------------|----------------|--------------|
| email | phone, gender | phone, gender |
| firstName / lastName | date of birth, weight, height, training frequency | type, price, Instapay or wallet, sport, headline, motivation, experience |
| profile photo URL | goals / injuries / files (optional) | intro, video, certificates, achievements, gallery (optional) |

---

## Mobile setup checklist

1. Configure Google Sign-In (Android package + SHA-1, iOS Bundle ID).
2. Use the same OAuth client IDs the backend has in `GOOGLE_CLIENT_IDS` / `GOOGLE_CLIENT_ID`.
3. Send the ID token to the API (not the Google access token).
4. Remove email/password registration. Keep email/password login for old accounts.
5. Coach signup sends `user_type: "coach"` on `POST /api/auth/google`.
6. Refresh tokens: `POST /api/user/refresh` when the access token expires.
7. On complete-profile, send both `googleSignupToken` and the same `idToken`.

---

## Quick test with Postman

1. Get a real `idToken` from the app.
2. `POST /api/auth/google` with `X-Api-Key` + `{ "idToken": "...", "user_type": "coach" }`.
3. If `needsProfileCompletion`, call `/api/auth/google/complete` with `googleSignupToken`, the same `idToken`, and coach fields.
4. Confirm the coach response has `userData.status: "pending"`.
5. Confirm `POST /api/register` returns `403`.
6. Confirm `POST /api/login` still works for an old email/password user, and rejects a Google-linked account.
