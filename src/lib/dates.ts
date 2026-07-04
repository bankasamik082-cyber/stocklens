// Date / timezone helpers.
//
// Twelve Data daily bars are dated in US *market* time (America/New_York) with
// no timezone suffix, e.g. "2024-06-03". Finnhub news `datetime` is a Unix UTC
// timestamp. To line news up with the trading day it actually moved, we must
// bucket news by its America/New_York calendar date, NOT by its UTC date —
// otherwise after-hours ET news (e.g. 8pm ET = next-day 00:00 UTC) is
// attributed to the wrong trading day.

const ET_ZONE = "America/New_York";

// en-CA formats as YYYY-MM-DD, which is exactly the shape we want.
const ET_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ET_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Convert a Unix-seconds timestamp to its America/New_York calendar date.
export function etDateFromUnix(unixSeconds: number): string {
  return ET_DATE_FMT.format(new Date(unixSeconds * 1000));
}

// Shift a YYYY-MM-DD date string by `deltaDays` calendar days (noon-anchored so
// DST transitions never bump us across a day boundary).
export function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// Whole calendar days between two YYYY-MM-DD strings (b - a).
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
