// RCE's timestamps (usage buckets, device/snapshot created_at/started_at) come back as UTC but
// without a trailing timezone designator (e.g. "2026-09-10T00:00:00", not "...Z") — the bare Date
// constructor treats a designator-less ISO string as LOCAL time per spec, silently shifting every
// displayed date/weekday/elapsed-time calculation for anyone not on UTC.

/** Parses an RCE API timestamp as UTC, appending `Z` only when the string doesn't already carry a
 *  timezone designator (a `Z` or a numeric `+HH:MM`/`-HH:MM` offset) — a no-op if the API ever
 *  starts including one itself. `.toLocaleString()`/`.toLocaleDateString()` with no `timeZone`
 *  option already render in the caller's local timezone by default once parsed correctly. */
export function parseRceUtcTimestamp(iso: string): Date {
  const hasDesignator = /[zZ]$|[+-]\d\d:\d\d$/.test(iso);
  return new Date(hasDesignator ? iso : `${iso}Z`);
}

/**
 * RCE's usage endpoint aggregates server-side on UTC boundaries — a `24h` bucket spans UTC
 * midnight to midnight, which is a DIFFERENT window than the caller's local calendar day unless
 * they happen to be on UTC (e.g. minutes used at 9pm Thursday in UTC-5 land in the "Friday" UTC
 * bucket). Parsing the timestamp correctly only fixes which day a bucket gets LABELED — it can't
 * fix which minutes actually got summed into it, since that grouping already happened server-side.
 * The fix is to fetch `1h` buckets instead and re-aggregate them into local calendar days here.
 *
 * Returns days sorted ascending, oldest first. Callers wanting exactly N days should slice the
 * tail (`.slice(-N)`) rather than trust the input bucket count, since converting a fixed UTC
 * fetch window to local days can span one more or fewer calendar day depending on the viewer's
 * offset and time of day.
 */
export function bucketRceUsageByLocalDay(buckets: Array<{ start: string; minutes: number }>): Array<{ date: Date; minutes: number }> {
  const byLocalDay = new Map<string, { date: Date; minutes: number }>();
  for (const b of buckets) {
    const instant = parseRceUtcTimestamp(b.start);
    const localMidnight = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
    const key = `${localMidnight.getFullYear()}-${localMidnight.getMonth()}-${localMidnight.getDate()}`;
    const existing = byLocalDay.get(key);
    if (existing) existing.minutes += b.minutes || 0;
    else byLocalDay.set(key, { date: localMidnight, minutes: b.minutes || 0 });
  }
  return [...byLocalDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
