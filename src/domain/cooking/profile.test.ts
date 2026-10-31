import { expect, test } from "vitest";
import {
  assertCookProfile,
  CookProfileError,
  kitSettingKey,
  parseMastery,
  parseStat,
  resolveDefaultKit,
} from "./profile";

const kits = [
  { id: 1, seedKey: "outdoor" },
  { id: 4, seedKey: null },
];

test("official kits keep their seed key and custom kits use their id", () => {
  expect(kitSettingKey({ id: 1, seedKey: "outdoor" })).toBe("outdoor");
  expect(kitSettingKey({ id: 12, seedKey: null })).toBe("kit:12");
  expect(kitSettingKey({ id: 12, seedKey: "" })).toBe("kit:12");
});

test("resolves the stored default kit", () => {
  expect(resolveDefaultKit(kits, "outdoor")?.id).toBe(1);
  expect(resolveDefaultKit(kits, "kit:4")?.id).toBe(4);
  expect(resolveDefaultKit(kits, "home")).toBeNull();
});

test("stats accept 0 through 999 and mastery accepts 0 through 1999", () => {
  expect(parseStat("0", "Base level")).toBe(0);
  expect(parseStat("099", "DEX")).toBe(99);
  expect(parseStat("999", "LUK")).toBe(999);
  expect(parseMastery("1999")).toBe(1999);

  expect(() => parseStat("", "Base level")).toThrow(CookProfileError);
  expect(() => parseStat("", "Base level")).toThrow(/required/);
  expect(() => parseStat("1000", "DEX")).toThrow(/0 to 999/);
  expect(() => parseStat("-1", "LUK")).toThrow(/0 to 999/);
  expect(() => parseStat("1.5", "Base level")).toThrow(/0 to 999/);
  expect(() => parseMastery("2000")).toThrow(/0 to 1999/);
});

test("a cook profile requires a known kit", () => {
  expect(
    assertCookProfile({ baseLevel: 99, dex: 99, luk: 1, mastery: 0, defaultKitKey: "kit:4" }, kits),
  ).toEqual({ baseLevel: 99, dex: 99, luk: 1, mastery: 0, defaultKitKey: "kit:4" });

  expect(() =>
    assertCookProfile(
      { baseLevel: 99, dex: 99, luk: 1, mastery: 0, defaultKitKey: "missing" },
      kits,
    ),
  ).toThrow(/cooking kit/i);
  expect(() =>
    assertCookProfile(
      { baseLevel: 1000, dex: 99, luk: 1, mastery: 0, defaultKitKey: "outdoor" },
      kits,
    ),
  ).toThrow(/Base level/);
});
