import { isValidLocalDate } from "./local-date.js";

export function isValidDiaryMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month] = value.split("-").map(Number);

  return Number.isInteger(year) && year >= 1000 && year <= 9999 && month >= 1 && month <= 12;
}

export function getDiaryMonthFromLocalDate(localDate) {
  return isValidLocalDate(localDate) ? localDate.slice(0, 7) : null;
}

export function addDiaryMonths(value, amount) {
  if (!isValidDiaryMonth(value) || !Number.isInteger(amount)) {
    return value;
  }

  const [year, month] = value.split("-").map(Number);
  const absoluteMonth = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonth = (absoluteMonth % 12 + 12) % 12 + 1;

  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;
}

export function getDiaryMonthRange(value, { localDate } = {}) {
  if (!isValidDiaryMonth(value)) {
    return null;
  }

  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${value}-01`;
  let endDate = `${value}-${String(lastDay).padStart(2, "0")}`;
  const currentMonth = getDiaryMonthFromLocalDate(localDate);

  if (currentMonth && value > currentMonth) {
    return {
      month: value,
      startDate,
      endDate: null,
      isFutureMonth: true
    };
  }

  if (currentMonth === value && localDate < endDate) {
    endDate = localDate;
  }

  return {
    month: value,
    startDate,
    endDate,
    isFutureMonth: false
  };
}

export function buildDiaryCalendar(entries, diaryMonth) {
  if (!isValidDiaryMonth(diaryMonth)) {
    return [];
  }

  const [year, month] = diaryMonth.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmpty = firstDay.getUTCDay();
  const entriesByDate = new Map(
    (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry?.checkin_date?.startsWith(`${diaryMonth}-`))
      .map((entry) => [entry.checkin_date, entry])
  );
  const cells = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    cells.push({ key: `empty-${index}`, empty: true });
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = `${diaryMonth}-${String(day).padStart(2, "0")}`;
    cells.push({
      key: dateKey,
      day,
      entry: entriesByDate.get(dateKey) || null
    });
  }

  return cells;
}
