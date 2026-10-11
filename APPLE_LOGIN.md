# Sign in with Apple (Mobile — Athletes and Coaches)

Apple Sign-In is a registration path for **athletes and coaches**, alongside Google. Email/password registration is closed. Email/password **login** stays available for accounts created before this change.

| Endpoint | Role |
|----------|------|
| `POST /api/login` | Existing email/password accounts only |
| `POST /api/register` | Rejected (`403`). Use Google or Apple |
| `POST /api/auth/apple` | Check / login |
| `POST /api/auth/apple/complete` | Finish a new athlete or coach profile |
| `POST /api/auth/google` | Same flow with Google |

Admins cannot use Apple Sign-In.

---

## Required header (every call)

See [CLIENT_API_KEY.md](./CLIENT_API_KEY.md).

```http
X-Api-Key: <CLIENT_API_KEY>
Content-Type: application/json
```

For `/auth/apple/complete` with file uploads, use `multipart/form-data` instead of JSON (still send `X-Api-Key`).

---

## Rate limits

| Scope | Limit | Applies to |
|-------|-------|------------|
| Auth routes | **20** requests / 15 min per IP | `/login`, `/register`, `/auth/apple`, `/auth/apple/complete`, Google auth, password-reset |

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
1. User taps "Sign in with Apple" on the athlete or coach signup screen
2. App gets identityToken (and firstName/lastName only on the first authorization)
3. POST /api/auth/apple  { identityToken, firstName?, lastName?, user_type }
4a. Existing coach or athlete → save token + refreshToken → home for that role
4b. New user → needsProfileCompletion: true
             → show the form for userType (prefill email / name)
             → POST /api/auth/apple/complete
                (appleSignupToken + same identityToken + remaining profile fields)
             → save token + refreshToken
             → athlete: home
             → coach: pending approval
```

**Do not** create a session after step 3 when `needsProfileCompletion` is `true` — there is no access JWT yet.

`appleSignupToken` expires in about **15 minutes** (override with env `APPLE_SIGNUP_TOKEN_EXPIRES_IN`). If it expires, send the user back to Sign in with Apple.

Keep the Apple `identityToken` until `/complete` succeeds — the complete step **re-verifies** it and checks it matches the signup token (`appleId`, and email when Apple still sends it).

Apple sends the person's name only the first time they authorize the app. Send `firstName` and `lastName` on that first `POST /api/auth/apple`. Later logins can omit them. The server does not take the name from the identity token, because Apple does not put it there. Apple does not send a profile photo; the user can upload `profileImage` on complete.

If the user chooses Hide My Email, Apple sends a relay address such as `abc123@privaterelay.appleid.com`. That address **is** the account email. Do not ask the user to replace it.

The role is stored in `appleSignupToken`. Coach apps must send `user_type: "coach"`. If `user_type` is omitted, a **new** user is an `athlete`.

---

## 1) Check / login — `POST /api/auth/apple`

### Request

```json
{
  "identityToken": "<Apple identity token from Sign in with Apple>",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "user_type": "coach"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `identityToken` | yes | From Sign in with Apple |
| `firstName` | no | Send on the first authorization. Stored on the signup token for new users. |
| `lastName` | no | Same as first name |
| `user_type` | no | `coach` or `athlete`. Default `athlete`. Used only for new accounts. |

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
    "profileImage": null,
    "status": "pending",
    "slug": "...",
    "shareProfileUrl": "..."
  }
}
```

`user.role` is the real account role. A local account with the same email is linked to Apple. If `authProvider` was `local`, the password is invalidated and `authProvider` becomes `apple`. A Google account keeps `authProvider: google` and also stores `appleId`, so both providers can sign in.

### Response — new user (must complete profile)

Status `200`:

```json
{
  "needsProfileCompletion": true,
  "appleSignupToken": "<short-lived token ~15m>",
  "email": "user@privaterelay.appleid.com",
  "firstName": "Doaa",
  "lastName": "Khalaf",
  "profileImage": null,
  "userType": "coach"
}
```

`firstName` / `lastName` are null when the app did not send them. Collect them on the complete screen in that case.

---

## 2) Complete signup — `POST /api/auth/apple/complete`

### Shared fields

| Field | Required | Notes |
|-------|----------|--------|
| `appleSignupToken` | yes | From step 1 |
| `identityToken` | yes | Same Apple identity token |

Email comes from the signup token. The live `identityToken` must be the same Apple user.

Athlete fields match [GOOGLE_LOGIN.md](./GOOGLE_LOGIN.md) (gender, phone, date of birth, weight, height, training frequency, optional goals/injuries/files). There is no Apple photo to prefill; `profileImage` is an optional upload.

### Coach fields

Same required coach fields as Google complete: `gender`, `phoneNumber`, `type` (`normal` \| `gym`), `monthlyPriceEgp`, Instapay link **or** `walletNumber`, `sport`, `headline`, `motivation`, `trainingExperience`, `yearOfExperience`.

Send `firstName` and `lastName` when step 1 returned them empty. Optional: `introduction`, `videoUrl`, `profileImage`, `certificates`, `achievements`, `galleryImages`.

New coaches are `pending` until an admin approves them.

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

Athlete success is the athlete resource, same shape as Google complete, with `message: "Athlete registered successfully"`.

### Errors

| Status | When |
|--------|------|
| `422` | Validation, or email / phone already exists |
| `401` | Invalid/expired `appleSignupToken`, invalid Apple `identityToken`, or identity mismatch |
| `403` | Existing account is not an athlete or coach |
| `429` | Rate limit |
| `500` | Apple / JWT config missing |

```json
{
  "status": "error",
  "message": "Apple Sign-In is available for athletes and coaches only"
}
```

`POST /api/register` returns `403` with `"Registration is only available with Google or Apple"`.

Accounts with `authProvider: apple` cannot use email/password login:

```json
{
  "status": "error",
  "message": "This account uses Apple Sign-In. Please continue with Apple."
}
```

---

## Frontend decision tree

```text
onAppleButtonPressed(userType):
  result = await AppleSignIn()
  res = POST /api/auth/apple {
    identityToken: result.identityToken,
    firstName: result.fullName?.givenName,
    lastName: result.fullName?.familyName,
    user_type: userType
  }

  if res.needsProfileCompletion === true:
      open CompleteCoachProfile or CompleteAthleteProfile from res.userType
      prefill email, firstName, lastName (profileImage is null)
      keep appleSignupToken AND identityToken
      onSubmit → POST /api/auth/apple/complete
      coach pending → waiting screen
      athlete → home
  else:
      save tokens and route by res.user.role
```

---

## Server env

| Variable | Purpose |
|----------|---------|
| `APPLE_CLIENT_IDS` | Comma-separated bundle IDs (identity token audience) |
| `JWT_SECRET` | Access JWT + `appleSignupToken` |
| `APPLE_SIGNUP_TOKEN_EXPIRES_IN` | Optional; default `15m` |
| `CLIENT_API_KEY` | Required on every `/api` request |
