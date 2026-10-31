import { DateTime } from "luxon";

export function formatLotDate(isoDate: string): string {
  const parsed = DateTime.fromISO(isoDate);
  if (!parsed.isValid) {
    return isoDate;
  }
  return parsed.toLocaleString(DateTime.DATE_MED);
}
