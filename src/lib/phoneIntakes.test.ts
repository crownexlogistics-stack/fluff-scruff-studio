import { describe, expect, it } from "vitest";
import { holdIsActive, normalizeIntakeMobile, intakeDetailsSchema } from "./phoneIntakes";
describe("phone intake rules", () => {
  const start = Date.parse("2026-11-02T10:00:00Z");
  const hold = { status: "awaiting" as const, hold_released_at: null, hold_expires_at: "2026-11-02T11:00:00Z" };
  it("releases a hold at exactly 60 minutes", () => {
    expect(holdIsActive(hold, start + 59 * 60_000)).toBe(true);
    expect(holdIsActive(hold, start + 60 * 60_000)).toBe(false);
  });
  it("submission does not extend the one-hour hold", () => {
    expect(holdIsActive({ ...hold, status: "submitted" }, start + 60 * 60_000)).toBe(false);
  });
  it("releases closed, booked and manually released holds", () => {
    expect(holdIsActive({ ...hold, status: "booked" }, start)).toBe(false);
    expect(holdIsActive({ ...hold, status: "closed" }, start)).toBe(false);
    expect(holdIsActive({ ...hold, hold_released_at: new Date(start).toISOString() }, start)).toBe(false);
  });
  it("accepts mobile numbers but not landlines", () => {
    expect(normalizeIntakeMobile("07700 900 123")).toBe("07700900123");
    expect(() => normalizeIntakeMobile("020 7946 0123")).toThrow();
  });
  it("requires customer identity and dog details", () => {
    const valid = { first_name: "Alex", surname: "Test", email: "alex@example.com", dog_name: "Pip", breed: "Poodle", notes: "", alternatives: "" };
    expect(intakeDetailsSchema.safeParse(valid).success).toBe(true);
    expect(intakeDetailsSchema.safeParse({ ...valid, surname: "" }).success).toBe(false);
  });
});