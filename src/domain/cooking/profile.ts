import { MASTERY_MAX, MASTERY_MIN, STAT_MAX, STAT_MIN, type CookProfile } from "./success";

export class CookProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CookProfileError";
  }
}

export type CookProfileDraft = CookProfile & {
  defaultKitKey: string;
};

export type KitIdentity = {
  id: number;
  seedKey: string | null;
};

export function kitSettingKey(kit: KitIdentity): string {
  return kit.seedKey ? kit.seedKey : `kit:${kit.id}`;
}

export function resolveDefaultKit<T extends KitIdentity>(
  kits: readonly T[],
  defaultKitKey: string,
): T | null {
  return kits.find((kit) => kitSettingKey(kit) === defaultKitKey) ?? null;
}

export function parseStat(value: string, label: string): number {
  return parseWholeNumber(value, label, STAT_MIN, STAT_MAX);
}

export function parseMastery(value: string): number {
  return parseWholeNumber(value, "Mastery", MASTERY_MIN, MASTERY_MAX);
}

export function assertCookProfile(
  draft: CookProfileDraft,
  kits: readonly KitIdentity[],
): CookProfileDraft {
  const kit = resolveDefaultKit(kits, draft.defaultKitKey);
  if (!kit) {
    throw new CookProfileError("Choose a cooking kit.");
  }
  return {
    baseLevel: assertWholeNumber(draft.baseLevel, "Base level", STAT_MIN, STAT_MAX),
    dex: assertWholeNumber(draft.dex, "DEX", STAT_MIN, STAT_MAX),
    luk: assertWholeNumber(draft.luk, "LUK", STAT_MIN, STAT_MAX),
    mastery: assertWholeNumber(draft.mastery, "Mastery", MASTERY_MIN, MASTERY_MAX),
    defaultKitKey: kitSettingKey(kit),
  };
}

export function cookProfileMessage(check: () => unknown): string | undefined {
  try {
    check();
    return undefined;
  } catch (error) {
    if (error instanceof CookProfileError) {
      return error.message;
    }
    throw error;
  }
}

function parseWholeNumber(value: string, label: string, min: number, max: number): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CookProfileError(`${label} is required.`);
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new CookProfileError(rangeMessage(label, min, max));
  }
  return assertWholeNumber(Number(trimmed), label, min, max);
}

function assertWholeNumber(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CookProfileError(rangeMessage(label, min, max));
  }
  return value;
}

function rangeMessage(label: string, min: number, max: number): string {
  return `${label} must be a whole number from ${min} to ${max}.`;
}
