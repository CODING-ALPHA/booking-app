# Koya Clinic Booking API

A minimal Next.js App Router clinic booking application built for the Koya Academy Cohort 4 assessment. The root routes (`/reset`, `/slots`, and `/bookings`) are the protected assessment API; `/` is a small patient booking page.

## Stack

Next.js, TypeScript, Tailwind CSS, PostgreSQL (`pg`), Zod, and Vitest. It uses only parameterized SQL and runs on the Node.js runtime, suitable for Netlify's Next.js support.

## Setup

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and a strong `API_KEY`.
2. For an external Neon database, run `psql "$DATABASE_URL" -f db/schema.sql` once. For Netlify Database, the migration under `netlify/database/migrations/` is applied by Netlify during deployment.
3. Run `npm install`, then `npm run dev`.

The API key is server-only. The web UI calls narrowly scoped `/api/web/*` adapters and never receives it.

## Commands

```sh
npm run dev
npm test
npm run build
```

## API

All assessment endpoints require `X-API-Key`:

```sh
curl -X POST http://localhost:3000/reset -H 'X-API-Key: YOUR_KEY' -H 'Content-Type: application/json' --data '{"slots":[{"id":"s1","provider":"Dr Ade","start":"2030-12-10T09:00:00Z","end":"2030-12-10T09:30:00Z"}]}'
curl http://localhost:3000/slots -H 'X-API-Key: YOUR_KEY'
curl -X POST http://localhost:3000/bookings -H 'X-API-Key: YOUR_KEY' -H 'Content-Type: application/json' --data '{"slot_id":"s1","name":"Ada Obi","email":"ada@example.com"}'
```

Routes: `POST /reset`, `GET /slots?provider=`, `POST /bookings`, `GET /bookings?email=&limit=&cursor=`, `GET /bookings/:id`, and `DELETE /bookings/:id`.

## Correctness decisions

- PostgreSQL's partial unique index guarantees at most one confirmed booking per slot. A transaction-level advisory lock additionally coordinates reset, booking, and cancellation so a reset cannot expose a partial slot set.
- Idempotency fingerprints the normalized `{slot_id,name,email}` JSON using SHA-256. Stored completed response bodies are replayed with their original status; a different fingerprint gives 422. Idempotent replays do not consume another rate-limit attempt.
- Pagination uses a base64url cursor containing the final `created_at` and `id`, matching the stable `(created_at, id)` order.
- Rate attempts are stored in PostgreSQL. A per-email advisory lock makes the rolling 60-second count atomic. Reset deletes bookings, slots, and idempotency records but deliberately retains anti-abuse attempt history.

## Tests

`tests/validation.test.ts` covers request normalization and schema edge cases. The architecture is ready for PostgreSQL integration tests against a dedicated `DATABASE_URL`; point test execution at an isolated database when adding full endpoint/concurrency coverage.

## Netlify deployment

Connect this GitHub repository to a Netlify site and set `API_KEY` in its environment variables. The installed `@netlify/database` package tells Netlify to provision its managed PostgreSQL database on deployment. Netlify then supplies `NETLIFY_DB_URL` to functions; this application uses it automatically unless `DATABASE_URL` is set. The `0001_clinic_schema.sql` migration is applied during deploy. Netlify's Next.js integration builds with `npm run build` without a custom `netlify.toml`. Do not add `API_KEY` as a `NEXT_PUBLIC_` value. After deploy, issue the curl commands above against the Netlify origin.

## Assumptions

The official OpenAPI document specifies a 200 response for reset but does not define a response body; this implementation returns `{}`. Reset accepts empty and past slot arrays. The database schema must be applied before deployment.
