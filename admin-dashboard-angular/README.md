# Trainify Admin Dashboard (Angular)

Standalone **admin web app**. Does not modify PromaxNode or the mobile apps.

## Run

```bash
cd admin-dashboard-angular
npm install
npm start
```

Open http://localhost:4200

Dev server **proxies** `/api` and `/images` (see `proxy.conf.cjs`).

Pick the API:

```bash
npm start              # reads .env API_TARGET (default local)
npm run start:local    # http://localhost:3000
npm run start:railway  # Railway production
```

Or in `.env`:

```
API_TARGET=local
# API_TARGET=railway
```

Restart `ng serve` after changing the proxy target.

Login: admin email/password (`POST /api/login`). Non-admin users are rejected in the UI.

## Pages → APIs

| Page | APIs |
|------|------|
| Login | `POST /api/login` |
| Overview | `GET /api/coaches?status=`, `GET /api/admin/coaches/subscription`, `GET /api/admin/payouts/upcoming` |
| Coaches | `GET /api/coaches?status=`, `PUT /api/coaches/:id/change-status?status=` |
| Athletes | `GET /api/athlete/all` |
| Payments | `GET /api/admin/coaches/subscription`, `PUT /api/admin/coaches/subscription/confirm/:id` |
| Payouts | `GET /api/admin/payouts/upcoming`, `GET /api/admin/payouts`, `POST /api/admin/payouts/generate`, `PATCH /api/admin/payouts/:id/mark-paid` |
| App version | `GET /api/app/version`, `PUT /api/admin/app/version` |
| Notifications / Chat / Gallery | No API — “Coming soon” |

Coach `:id` is **User `_id`**. Payment confirm `:id` is **subscription id**. `removed` hard-deletes the coach user.

## Production (same Railway service as API)

The dashboard is built in Docker and served by Express from `/` on the same PromaxNode service.

1. Push/deploy the backend as usual (Dockerfile builds Angular then starts Node).
2. Open your API domain root, e.g. `https://promax-node-production-7c35.up.railway.app/`
3. Login with an **admin** account.

`environment.prod.ts` uses `apiBase: ''` so `/api` and `/images` hit the same host (no CORS needed).

Local production-like check:

```bash
# from repo root
npm run build:admin
npm start
# open http://localhost:3000
```

Dev UI still uses `ng serve` + proxy (`npm run start:local` / `start:railway` inside `admin-dashboard-angular`).

The unused React folder `admin-dashboard/` can be deleted locally if you do not need it.
