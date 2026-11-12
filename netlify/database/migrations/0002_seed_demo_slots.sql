-- Give a fresh assessment database bookable examples without replacing real slots.
-- The assessment's /reset endpoint remains the authoritative way to replace slots.
WITH samples AS (
  SELECT
    item.id,
    item.provider,
    (
      date_trunc('day', now() AT TIME ZONE 'Africa/Lagos')
      + item.day_offset * interval '1 day'
      + item.hour_of_day * interval '1 hour'
    ) AT TIME ZONE 'Africa/Lagos' AS start
  FROM (VALUES
    ('demo-visit-01', 'Demo clinician A', 1, 9),
    ('demo-visit-02', 'Demo clinician B', 2, 10),
    ('demo-visit-03', 'Demo clinician A', 3, 11),
    ('demo-visit-04', 'Demo clinician B', 5, 9),
    ('demo-visit-05', 'Demo clinician A', 7, 10),
    ('demo-visit-06', 'Demo clinician B', 10, 11),
    ('demo-visit-07', 'Demo clinician A', 14, 9),
    ('demo-visit-08', 'Demo clinician B', 21, 10)
  ) AS item(id, provider, day_offset, hour_of_day)
)
INSERT INTO slots (id, provider, start, "end")
SELECT id, provider, start, start + interval '30 minutes'
FROM samples
WHERE NOT EXISTS (SELECT 1 FROM slots WHERE start > now())
ON CONFLICT (id) DO NOTHING;
