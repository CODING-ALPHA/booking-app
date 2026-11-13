-- Add weekday appointments through December 2026 without changing existing slots
-- or bookings. The IDs are stable so an accidental re-apply cannot duplicate them.
WITH weekdays AS (
  SELECT day::date AS day
  FROM generate_series(date '2026-11-16', date '2026-12-31', interval '1 day') AS dates(day)
  WHERE extract(isodow FROM day) BETWEEN 1 AND 5
), new_slots AS (
  SELECT
    'demo-' || to_char(weekdays.day, 'YYYYMMDD') || '-' || times.code AS id,
    times.provider,
    (weekdays.day::timestamp + times.hour_of_day * interval '1 hour') AT TIME ZONE 'Africa/Lagos' AS start
  FROM weekdays
  CROSS JOIN (VALUES
    ('0900', 9, 'Demo clinician A'),
    ('1000', 10, 'Demo clinician B')
  ) AS times(code, hour_of_day, provider)
)
INSERT INTO slots (id, provider, start, "end")
SELECT id, provider, start, start + interval '30 minutes'
FROM new_slots
WHERE start > now()
ON CONFLICT (id) DO NOTHING;
