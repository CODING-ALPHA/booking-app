import { NetlifyDB } from "@netlify/database-dev";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBooking, getBooking, cancelBooking } from "../lib/bookings";
import { getPool } from "../lib/db";
import { listSlots, replaceSlots } from "../lib/slots";
import { GET as getProtectedSlots } from "../app/slots/route";
import { GET as listProtectedBookings, POST as postProtectedBooking } from "../app/bookings/route";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const slot = (id: string) => ({ id, provider: "Test clinician", start: future(10), end: future(10.02) });

describe("PostgreSQL booking integration", () => {
  let database: NetlifyDB;

  beforeAll(async () => {
    database = new NetlifyDB({ logger: () => {} });
    process.env.DATABASE_URL = await database.start();
    process.env.API_KEY = "integration-test-key";
    await database.applyMigrations("./netlify/database/migrations");
  }, 60_000);

  afterAll(async () => {
    await getPool().end();
    await database.stop();
    delete process.env.DATABASE_URL;
    delete process.env.API_KEY;
  }, 30_000);

  it("lists, books, looks up, cancels, and frees a persisted slot", async () => {
    await replaceSlots([slot("flow")]);
    expect((await listSlots())[0].available).toBe(true);
    const created = await createBooking({ slot_id: "flow", name: "Ada", email: "flow@example.com" }, null);
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    expect((await getBooking(id))?.status).toBe("confirmed");
    expect((await listSlots())[0].available).toBe(false);
    expect((await cancelBooking(id)).status).toBe(200);
    expect((await getBooking(id))?.status).toBe("cancelled");
    expect((await listSlots())[0].available).toBe(true);
  });

  it("replays the same booking and rejects a changed idempotency key body", async () => {
    await replaceSlots([slot("retry")]);
    const input = { slot_id: "retry", name: "Bisi", email: "retry@example.com" };
    const first = await createBooking(input, "test-retry-key");
    const replay = await createBooking(input, "test-retry-key");
    expect(first.status).toBe(201);
    expect(replay).toEqual(first);
    expect((await createBooking({ ...input, name: "Changed" }, "test-retry-key")).status).toBe(422);
  });

  it("permits only one winner when bookings arrive together", async () => {
    await replaceSlots([slot("race")]);
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => createBooking({ slot_id: "race", name: `Patient ${index}`, email: `race${index}@example.com` }, null)));
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(19);
  }, 30_000);

  it("counts failed attempts and sends Retry-After on the sixth", async () => {
    await replaceSlots([]);
    const input = { slot_id: "missing", name: "Caro", email: "limit@example.com" };
    const results = [];
    for (let index = 0; index < 6; index++) results.push(await createBooking(input, null));
    expect(results.slice(0, 5).map((result) => result.status)).toEqual([404, 404, 404, 404, 404]);
    expect(results[5].status).toBe(429);
    expect(Number(results[5].headers?.["Retry-After"])).toBeGreaterThan(0);
  });

  it("requires the API key and validates booking requests", async () => {
    await replaceSlots([slot("protected")]);
    const unauthorized = await getProtectedSlots(new Request("http://localhost/slots"));
    expect(unauthorized.status).toBe(401);
    const authorized = await getProtectedSlots(new Request("http://localhost/slots", { headers: { "X-API-Key": "integration-test-key" } }));
    expect(authorized.status).toBe(200);
    const invalid = await postProtectedBooking(new Request("http://localhost/bookings", { method: "POST", headers: { "X-API-Key": "integration-test-key", "Content-Type": "application/json" }, body: JSON.stringify({ slot_id: "protected", name: " ", email: "bad" }) }));
    expect(invalid.status).toBe(400);
  });

  it("pages through one person's bookings with a cursor", async () => {
    await replaceSlots([slot("page-1"), slot("page-2"), slot("page-3")]);
    for (const id of ["page-1", "page-2", "page-3"]) {
      expect((await createBooking({ slot_id: id, name: "Dayo", email: "pages@example.com" }, null)).status).toBe(201);
    }
    const headers = { "X-API-Key": "integration-test-key" };
    const first = await listProtectedBookings(new Request("http://localhost/bookings?email=PAGES@EXAMPLE.COM&limit=2", { headers }));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.bookings).toHaveLength(2);
    expect(firstBody.next_cursor).toBeTruthy();
    const second = await listProtectedBookings(new Request(`http://localhost/bookings?email=pages@example.com&limit=2&cursor=${encodeURIComponent(firstBody.next_cursor)}`, { headers }));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.bookings).toHaveLength(1);
    expect(secondBody.next_cursor).toBeNull();
    expect((await listProtectedBookings(new Request("http://localhost/bookings?email=pages@example.com&limit=0", { headers }))).status).toBe(400);
  });
});
