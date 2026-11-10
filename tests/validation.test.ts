import { describe, expect, it } from "vitest";
import { bookingSchema, resetSchema } from "../lib/validation";
describe("booking validation", () => {
  it("trims names and normalizes email", () => expect(bookingSchema.parse({ slot_id: "s1", name: " Ada Obi ", email: " ADA@EXAMPLE.COM " })).toEqual({ slot_id: "s1", name: "Ada Obi", email: "ada@example.com" }));
  it("rejects invalid booking input", () => { expect(bookingSchema.safeParse({ slot_id: "", name: " ", email: "nope" }).success).toBe(false); });
  it("allows a past reset slot but rejects inverted ranges", () => { expect(resetSchema.safeParse({ slots: [{ id: "old", provider: "Dr A", start: "2020-01-01T09:00:00Z", end: "2020-01-01T09:30:00Z" }] }).success).toBe(true); expect(resetSchema.safeParse({ slots: [{ id: "bad", provider: "Dr A", start: "2026-01-01T10:00:00Z", end: "2026-01-01T09:00:00Z" }] }).success).toBe(false); });
});
