export const CHECKIN_EVENT_KEYS = [
  "newProductUsed",
  "activeProductUsed",
  "exfoliationUsed",
  "moisturizerSkipped",
  "sleepDeprived",
  "workoutOrSweat"
];

export const CHECKIN_EVENT_TAG_ORDER = [
  ...CHECKIN_EVENT_KEYS,
  "makeup",
  "outdoor"
];

function normalizeContextSource(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function normalizeCheckinEvents(value) {
  const context = normalizeContextSource(value);
  const eventSource = normalizeContextSource(context.checkinEvents);

  return CHECKIN_EVENT_KEYS.reduce((events, key) => {
    events[key] = eventSource[key] === true;
    return events;
  }, {});
}

export function mergeCheckinEventsContext(existingContext, nextEvents) {
  const base = normalizeContextSource(existingContext);

  return {
    ...base,
    source: "my-check-in",
    checkinEvents: normalizeCheckinEvents({ checkinEvents: nextEvents })
  };
}

export function getSelectedCheckinEventKeys(context) {
  const events = normalizeCheckinEvents(context);

  return CHECKIN_EVENT_KEYS.filter((key) => events[key]);
}
