# RO Service Management System

A production-oriented system for managing RO (water purifier) service visits:
technicians report on jobs from a mobile app, customers view reports and file
complaints from a no-login public web link, and admins run everything from a
web dashboard.

```
backend/   Node.js + Express API, PostgreSQL, S3-compatible file storage
web/       Next.js — public /report/[token] page + admin dashboard
mobile/    React Native — technician app
```

## What changed vs. the original draft

If you're comparing this against an earlier version of this code, the
important fixes are:

1. **`POST /auth/register` is now admin-only.** The original endpoint let
   anyone create an account with `role: "admin"` — a full authentication
   bypass. A one-time `scripts/create-admin.js` bootstraps the first admin.
2. **Complaints derive `job_id` from the access token server-side**, not
   from a client-supplied field, so a customer can only file a complaint
   against the job their link actually points to.
3. **Refresh tokens are stored (hashed) and revocable** in a `refresh_tokens`
   table, so logout / disabling a user actually invalidates sessions instead
   of trusting any correctly-signed JWT forever.
4. **`report_access_tokens.job_id` has a real `UNIQUE` constraint** — the
   admin "generate link" route uses `ON CONFLICT (job_id) DO UPDATE`, which
   would fail at runtime without it.
5. **CORS is locked to an explicit origin allowlist**, not `cors()` wide open.
6. **Rate limiting is actually wired in** on `/auth/login`, `/auth/refresh`,
   the public complaint endpoint, and the public report lookup.
7. File uploads pick their S3 key/extension from the **detected MIME type**,
   not the client-supplied filename, closing a path-traversal / spoofed
   extension gap.
8. Added the pieces the spec asked for that weren't in the draft: DB
   migrations, the full admin API (user management, job assignment, report/
   complaint oversight, link revocation), the Next.js admin dashboard, and
   the technician-app login/job-list screens.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- An S3-compatible bucket (AWS S3 or Cloudflare R2)
- For the mobile app: a React Native dev environment (Android Studio and/or
  Xcode) — see [reactnative.dev/docs/environment-setup](https://reactnative.dev/docs/environment-setup)

## 1. Backend setup

```bash
cd backend
cp .env.example .env
# edit .env with your real DB / JWT secrets / S3 credentials
npm install
npm run migrate          # applies migrations/001_init.sql
node scripts/create-admin.js   # creates the first admin using BOOTSTRAP_ADMIN_* from .env
npm run dev               # http://localhost:4000
```

Generate strong secrets instead of the placeholders:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `CORS_ORIGINS` | Comma-separated allowlist of origins allowed to call the API |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets — must be long, random, and different from each other |
| `ACCESS_TOKEN_TTL` | e.g. `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | e.g. `7` |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` |
| `FRONTEND_URL` | Base URL of the public web app, used to build `/report/{token}` links |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET` | S3 credentials |
| `AWS_S3_ENDPOINT` | Only set for Cloudflare R2 or other S3-compatible endpoints; leave blank for real AWS S3 |
| `BOOTSTRAP_ADMIN_PHONE` / `BOOTSTRAP_ADMIN_PASSWORD` | Used once by `scripts/create-admin.js` |

## 2. Web app setup (public report page + admin dashboard)

```bash
cd web
cp .env.local.example .env.local
# set API_URL and NEXT_PUBLIC_API_URL to your backend, e.g. http://localhost:4000/api
npm install
npm run dev                # http://localhost:3000
```

- Public customer link: `http://localhost:3000/report/<token>`
- Admin panel: `http://localhost:3000/admin/login`

## 3. Mobile app setup (technician)

```bash
cd mobile
npm install
```

- Edit `mobile/lib/api.js` and set `API_BASE_URL` to your backend's
  reachable address (your machine's LAN IP for a physical device/emulator —
  `localhost` inside an emulator points at the emulator itself, not your dev
  machine).
- Copy the permission declarations from `mobile/permissions-setup/` into
  `android/app/src/main/AndroidManifest.xml` and `ios/YourApp/Info.plist`
  after running `npx react-native init` (or into your existing native
  project if you already have one — this repo ships the JS layer only, run
  `react-native-community/cli` or Expo bare workflow to generate the native
  Android/iOS folders first).

```bash
npm run android   # or
npm run ios
```

The app requests microphone/camera permission at the moment the technician
taps record/capture, not on launch, and sends the user to Settings with a
friendly message if permission was denied.

## Core flows

- **Admin** creates technician and customer accounts (`/admin/users`),
  creates jobs and assigns a technician (`/admin/jobs`), generates a
  time-limited report link per job, and can revoke it at any time.
- **Technician** logs into the mobile app, sees only jobs assigned to them,
  marks a job in-progress/completed, and submits a report (text and/or
  Hindi/English audio) with photos.
- **Customer** opens their link (no login), sees the report, photos, and
  audio, and can submit a complaint/feedback — text and/or audio — which is
  tied to their job automatically.

## Security notes for deployment

- Terminate TLS in front of this API (nginx/ALB/Cloudflare) — the app
  assumes HTTPS and sets `trust proxy` accordingly.
- Rotate `JWT_SECRET`/`JWT_REFRESH_SECRET` if ever leaked; rotating
  `JWT_REFRESH_SECRET` invalidates all refresh tokens immediately.
- Consider making the S3 bucket private and switching to pre-signed URLs
  (`S3_PRIVATE_BUCKET=true` is scaffolded in `.env.example` — wire it up in
  `middleware/upload.js` / the report routes if your bucket isn't public).
- The `audit_log` table records logins, user/job/report/complaint/link
  changes — review it periodically or ship it to a SIEM.
- Run `npm audit` in each of the three project folders before going to
  production and keep dependencies patched.

## Deploying

- **Backend**: any Node host (Render, Railway, Fly.io, ECS, a plain VM). Run
  `npm run migrate` once against your production database, then
  `node scripts/create-admin.js`, then `npm start`.
- **Web**: deploy to Vercel or any Node host with `npm run build && npm start`.
- **Mobile**: build signed release binaries via `react-native run-android
  --variant=release` / Xcode Archive, or use EAS/Fastlane if you adopt Expo
  or Fastlane later.

## Optional: speech-to-text

`reports.audio_url` and `complaints.audio_url` are plain S3 URLs. To add
transcription later, add a background job (e.g. triggered by an S3 event or
a queue) that calls Google Cloud Speech-to-Text or AWS Transcribe on the
audio file and writes the result into a new `transcript` column — no schema
changes are required to the existing tables to bolt this on.
