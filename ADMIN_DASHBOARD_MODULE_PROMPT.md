# Prompt: Admin Dashboard (separate module)

Copy everything below the line into a **new chat / new repo** (web admin only).  
Do **not** change the mobile app or existing PromaxNode APIs unless you explicitly ask later.

---

## Task

Build a **standalone Admin Dashboard web app** as a **separate module** (new folder ). It is an internal tool for Trainify / Promax admins.

**Hard rule:** do **not** edit existing mobile frontend, coach/athlete app, or backend files unless an API is truly missing. Consume the **current Node API as-is**. If something cannot be done with existing endpoints, show a disabled UI + “API not available” — do **not** invent breaking backend changes.

Stack (unless the user specifies otherwise): **Angular** (standalone) + Angular Router. Keep it a SPA.

---

## Auth

- Login with the **same backend** as the mobile app.
- Send `Authorization: Bearer <token>` on every request.
- After login, only allow role **`admin`**. Other roles: logout + error.
- Persist token (memory + `localStorage`). Redirect unauthenticated users to `/login`.
- Base URL from env: `VITE_API_BASE_URL` (example: `https://promax-node-production-7c35.up.railway.app/api`).

If the login path in the existing app is `POST /api/...` (check `Routes/signUp.js` / login controller in PromaxNode), use that exact path. Do not guess a new auth API.

---

## Existing admin APIs (use these)

PromaxNode mount: `/api/admin`, `/api/coaches`, `/api/athlete`.

### Coaches (users)

| Action | Method | URL |
|--------|--------|-----|
| List coaches (public-ish with subscription data) | `GET` | `/api/coaches` |
| Coach profile | `GET` | `/api/coaches/my-profile/:id` (auth) |
| Activate (legacy) | `PUT` | `/api/coaches/:id/activate` |
| **Change status** | `PUT` | `/api/coaches/:id/change-status?status=` |

`:id` = **User `_id`**, not Coach document id.

Query `status`: `pending` | `active` | `rejected` | `removed`  
`removed` **hard-deletes** Coach + User — confirm in UI.

Guide: `CHANGE_COACH_STATUS_FRONTEND_GUIDE.md`

### Athletes

| Action | Method | URL |
|--------|--------|-----|
| List all athletes | `GET` | `/api/athlete/all` (admin) |

### Subscriptions / payments (Instapay review)

| Action | Method | URL |
|--------|--------|-----|
| Pending subscription payments | `GET` | `/api/admin/coaches/subscription` |
| Confirm / reject / refund | `PUT` | `/api/admin/coaches/subscription/confirm/:paymentId` |

- `:paymentId` is treated as **subscription id** in the current controller.
- Body: `{ "status": "active" \| "rejected" \| "refunded", "rejectionReason": "optional" }`
- Pending list uses `SubscriptionPayment` with `status: "pending"`.

### Coach payouts (earnings)

| Action | Method | URL |
|--------|--------|-----|
| Upcoming payouts (all coaches) | `GET` | `/api/admin/payouts/upcoming?includeZero=true` |
| One coach upcoming details | `GET` | `/api/admin/payouts/upcoming/:coachId` |
| List payouts (filters) | `GET` | `/api/admin/payouts?coachId=&status=&from=&to=` |
| Generate payout drafts | `POST` | `/api/admin/payouts/generate` |
| Mark payout paid | `PATCH` | `/api/admin/payouts/:id/mark-paid` |

Body generate (optional): `{ scheduledDate }` or `{ periodStart, periodEnd, coachId }`.  
Mark paid: `{ paidBy, paymentReference, notes }` as implemented.

Guide: `EARNINGS_FRONTEND_GUIDE.md` (admin sections / payout rules: transfers on day **1** and **16**; `pending` is a draft, not paid).

### App version

| Action | Method | URL |
|--------|--------|-----|
| Get | `GET` | `/api/app/version` |
| Set | `PUT` | `/api/admin/app/version` |

---

## Dashboard modules (pages)

Build an **admin layout**: sidebar + top bar (admin name, logout).

1. **Overview / statistics**  
   Derive KPIs **client-side** from list APIs (do not add a stats endpoint unless asked):
   - Coaches by status (pending / active / rejected) if list exposes `status`
   - Pending subscription payments count
   - Upcoming payout total + coach count
   - Simple charts (bar/donut) from those numbers  
   Cards + tables, Arabic-friendly UI (RTL optional; support AR labels).

2. **Users → Coaches**  
   Table: name, email, phone, status, actions.  
   Filters: status.  
   Actions: view profile, `active` / `pending` / `rejected`, `removed` with confirm.

3. **Users → Athletes**  
   Table from `GET /api/athlete/all`. Read-only if no update API.

4. **Subscriptions & payments**  
   Queue of pending Instapay/wallet proofs.  
   Show athlete, coach, amount, plan, payment image.  
   Actions: Approve (`active`), Reject (+ reason), Refund if used.

5. **Payouts**  
   Upcoming period, generate drafts, list history, mark paid.  
   Never treat `pending` payout as money sent.

6. **App settings**  
   Min app version form.

7. **Optional empty states** for things with **no API yet** (do not fake data):
   - Global notifications blast
   - Chat moderation
   - Gallery moderation  
   Label: “Coming soon — no admin API”.

---

## UX / quality

- Loading, empty, and error states.
- Confirm destructive actions (`removed`, reject, mark-paid).
- Don’t break if a field is missing (backend responses are inconsistent: `success` vs `status`).
- Normalize API wrappers in one `src/api/` client.
- Responsive: desktop-first, usable tablet.
- No changes to PromaxNode, React Native, or old web landing (`trainify`) unless asked.

---

## Out of scope

- Coach/athlete mobile screens  
- Editing `PromaxNode` routes/controllers  
- New Mongo collections  
- Replacing Railway/Mongo  

---

## Deliverable

- New app (e.g. `admin-dashboard/`) with README: env vars, how to run, which APIs each page uses.
- `.env.example` with `VITE_API_BASE_URL`.
- Keep code modular: `pages/`, `api/`, `layouts/AdminLayout.tsx`.

Start by mapping login + listing coaches, then payments, then payouts, then stats widgets.

**Frontend stack:** **Angular** (standalone components, `admin-dashboard-angular/`). Do not use React.
