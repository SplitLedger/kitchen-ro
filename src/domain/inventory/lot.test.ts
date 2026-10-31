import { DateTime } from "luxon";
import { expect, test } from "vitest";
import {
  parseAcquiredOn,
  parseLotNote,
  parseLotQuantity,
  parseLotUnitPrice,
  todayIsoDate,
} from "./lot";

test("a new lot needs at least one, and an edit can reach zero", () => {
  expect(parseLotQuantity("4", "create")).toBe(4);
  expect(parseLotQuantity("0", "edit")).toBe(0);
  expect(() => parseLotQuantity("0", "create")).toThrow(/at least 1/);
  expect(() => parseLotQuantity("", "create")).toThrow(/required/);
});

test("unit price allows zero and rejects a blank", () => {
  expect(parseLotUnitPrice("0")).toBe(0);
  expect(() => parseLotUnitPrice("")).toThrow(/required/);
  expect(() => parseLotUnitPrice("-1")).toThrow(/whole number/);
});

test("acquired date is a real calendar day, and today comes from Luxon", () => {
  expect(parseAcquiredOn("2026-10-31")).toBe("2026-10-31");
  expect(() => parseAcquiredOn("2026-02-31")).toThrow(/real date/);
  expect(todayIsoDate(DateTime.fromISO("2026-10-31T15:00:00"))).toBe("2026-10-31");
});

test("note is optional and trimmed", () => {
  expect(parseLotNote("  farmed patch  ")).toBe("farmed patch");
  expect(parseLotNote("")).toBe("");
  expect(() => parseLotNote("x".repeat(201))).toThrow(/200/);
});
