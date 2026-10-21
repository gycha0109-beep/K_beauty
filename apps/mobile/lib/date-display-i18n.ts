import type { SupportedLocale } from "@bejewely/shared";

// Display-only calendar dates. Parse components in UTC so device time zones
// cannot move a saved diary entry to an adjacent calendar day.
export function formatNativeCalendarDate(
  raw: string | null | undefined,
  locale: SupportedLocale,
  monthOnly = false
): string {
  if (typeof raw !== "string") return "";
  const input = raw.trim();
  const match = monthOnly
    ? /^(\d{4})-(\d{2})$/.exec(input)
    : /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return input;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = monthOnly ? 1 : Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) return input;

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    year: "numeric",
    month: monthOnly ? "short" : "short",
    ...(monthOnly ? {} : { day: "numeric" })
  }).format(date);
}
