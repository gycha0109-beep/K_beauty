export function isValidLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getLocalDateString(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60 * 1000;

  return new Date(localTime).toISOString().slice(0, 10);
}

export function getBrowserDateContext(date = new Date()) {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";

  return {
    // User-facing calendar date. Persistence still uses created_at for UTC event time.
    localDate: getLocalDateString(date),
    timezone
  };
}

export function getUtcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getUtcDayNumber(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);

  return Date.UTC(year, month - 1, day) / 86400000;
}

export function isLocalDateInServerWindow(localDate, now = new Date(), dayWindow = 2) {
  if (!isValidLocalDate(localDate)) {
    return false;
  }

  const serverDay = getUtcDayNumber(getUtcDateString(now));
  const checkinDay = getUtcDayNumber(localDate);

  return Math.abs(checkinDay - serverDay) <= dayWindow;
}
