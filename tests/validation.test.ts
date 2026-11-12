import { describe, expect, it } from "vitest";
import { bookingSchema, isBookingId, resetSchema } from "../lib/validation";
describe("booking validation", () => {
  it("trims names and normalizes email", () => expect(bookingSchema.parse({ slot_id: "s1", name: " Ada Obi ", email: " ADA@EXAMPLE.COM " })).toEqual({ slot_id: "s1", name: "Ada Obi", email: "ada@example.com" }));
  it("rejects invalid booking input", () => { expect(bookingSchema.safeParse({ slot_id: "", name: " ", email: "nope" }).success).toBe(false); });
  it("allows a past reset slot but rejects inverted ranges", () => { expect(resetSchema.safeParse({ slots: [{ id: "old", provider: "Dr A", start: "2020-01-01T09:00:00Z", end: "2020-01-01T09:30:00Z" }] }).success).toBe(true); expect(resetSchema.safeParse({ slots: [{ id: "bad", provider: "Dr A", start: "2026-01-01T10:00:00Z", end: "2026-01-01T09:00:00Z" }] }).success).toBe(false); });
  it("rejects duplicate slot ids before replacing any data", () => { const item = { id: "same", provider: "Dr A", start: "2030-01-01T09:00:00Z", end: "2030-01-01T09:30:00Z" }; expect(resetSchema.safeParse({ slots: [item, item] }).success).toBe(false); });
  it("recognizes booking UUIDs", () => { expect(isBookingId("d9ad4051-bfa0-4ae9-ad2b-22d08278e93a")).toBe(true); expect(isBookingId("not-a-uuid")).toBe(false); });
});
