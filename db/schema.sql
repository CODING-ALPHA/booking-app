CREATE TABLE IF NOT EXISTS slots (
  id text PRIMARY KEY,
  provider text NOT NULL,
  start timestamptz NOT NULL,
  "end" timestamptz NOT NULL,
  CHECK ("end" > start)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  slot_id text NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_confirmed_booking_per_slot ON bookings(slot_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_email_created_idx ON bookings(email, created_at, id);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key text PRIMARY KEY,
  fingerprint text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_attempts_email_time_idx ON booking_attempts(email, attempted_at);
