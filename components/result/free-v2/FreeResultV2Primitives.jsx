"use client";

export function FreeResultV2StepFrame({ title, body = "", children }) {
  return (
    <section className="space-y-4">
      <div className="px-1">
        <h2 className="text-[2rem] font-semibold leading-tight text-[#26101a] dark:text-[#fff8f3] sm:text-[2.25rem]">
          {title}
        </h2>
        {body ? (
          <p className="mt-2 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">{body}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function FreeResultV2Card({ children, className = "", ...props }) {
  return (
    <div
      className={`rounded-[2rem] border border-[#ead9d6] bg-[#fffaf6] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.14)] dark:border-[#4a303c] dark:bg-[#241720] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function FreeResultV2Pill({ children }) {
  return (
    <span className="inline-flex rounded-full border border-[#ead2ca] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#5a2d3c] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
      {children}
    </span>
  );
}

export function FreeResultV2FaceLabMoodIcon({ type = "mood" }) {
  if (type === "tone") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M12.2 4.2c4.4 0 7.8 2.8 7.8 6.7 0 3-2 5.4-4.9 5.4h-.9c-.8 0-1.3.5-1.3 1.2 0 .6.4 1 .4 1.5 0 .6-.6.9-1.3.9-4.5 0-8-3.3-8-7.8 0-4.4 3.5-7.9 8.2-7.9Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8.3" cy="10" r="1" fill="currentColor" />
        <circle cx="11.4" cy="7.8" r="1" fill="currentColor" opacity="0.8" />
        <circle cx="15.1" cy="9.1" r="1" fill="currentColor" opacity="0.68" />
      </svg>
    );
  }

  if (type === "style") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M12 4.5 13.2 8.5 17.2 9.7 13.2 10.9 12 14.9 10.8 10.9 6.8 9.7 10.8 8.5 12 4.5Z" fill="currentColor" />
        <path d="M17.5 13.6 18.2 15.5 20 16.2 18.2 16.9 17.5 18.8 16.8 16.9 15 16.2 16.8 15.5 17.5 13.6Z" fill="currentColor" opacity="0.62" />
        <path d="M6.2 14.5 6.8 15.9 8.2 16.5 6.8 17.1 6.2 18.5 5.6 17.1 4.2 16.5 5.6 15.9 6.2 14.5Z" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M5.8 18.2h12.4l.9-9-3.8 2-3.3-5-3.3 5-3.8-2 .9 9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.2 15.3h9.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.72" />
    </svg>
  );
}

export function FreeResultV2PriorityIcon({ rank }) {
  const rankKey = String(rank);

  if (rankKey === "2") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4.2c3.1 3.5 5.2 6.5 5.2 9.2a5.2 5.2 0 0 1-10.4 0C6.8 10.7 8.9 7.7 12 4.2Z" fill="currentColor" opacity="0.86" />
      </svg>
    );
  }

  if (rankKey === "3") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4.5 18 7v5.2c0 3.4-2.2 5.9-6 7.3-3.8-1.4-6-3.9-6-7.3V7l6-2.5Z" fill="currentColor" opacity="0.86" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="1.7" fill="currentColor" />
      <circle cx="12" cy="6.5" r="1.7" fill="currentColor" opacity="0.78" />
      <circle cx="17" cy="8" r="1.7" fill="currentColor" />
      <circle cx="9" cy="13" r="1.7" fill="currentColor" opacity="0.72" />
      <circle cx="15" cy="13" r="1.7" fill="currentColor" opacity="0.72" />
      <circle cx="12" cy="17.5" r="1.7" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function FreeResultV2LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M8 10V7.8C8 5.7 9.6 4 12 4s4 1.7 4 3.8V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6.5" y="10" width="11" height="9" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function FreeResultV2EvidenceSourceIcon({ tone = "photo", className = "h-5 w-5" }) {
  const isSurvey = tone === "survey";

  return isSurvey ? (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M8 5h8M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="6" y="3" width="12" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M8 7h8l1 2h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2l1-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function FreeResultV2RoleIcon({ type = "moisture" }) {
  if (type === "light") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M5 15.5C10.8 14.9 15.4 11 18.4 5c1.4 6.8-1 11.8-6.1 13.5-2.5.8-5 .2-7.3-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.8 15.2c1.9-1.6 3.7-2.8 5.8-3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "daily") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <rect x="5" y="5.5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 4v3M16 4v3M5 10h14M9 14h1.5M13.5 14H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 4.4c3 3.5 5.1 6.4 5.1 9.1a5.1 5.1 0 0 1-10.2 0c0-2.7 2.1-5.6 5.1-9.1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function FreeResultV2RoutineModeIcon({ tone = "morning" }) {
  const isNight = tone === "night";

  return isNight ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M17.4 15.7A7.1 7.1 0 0 1 8.3 6.6 7.4 7.4 0 1 0 17.4 15.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.8v2M12 18.2v2M4.8 12h2M17.2 12h2M6.9 6.9l1.4 1.4M15.7 15.7l1.4 1.4M17.1 6.9l-1.4 1.4M8.3 15.7l-1.4 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FreeResultV2RoutineIcon({ tone = "morning" }) {
  const isNight = tone === "night";

  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
      isNight
        ? "border-[#cda7ff]/34 bg-[#3a2340]/50 text-[#d8b6ff]"
        : "border-[#ff9a8a]/36 bg-[#41212b]/46 text-[#ff9a8a]"
    }`}>
      {isNight ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M17.4 15.7A7.1 7.1 0 0 1 8.3 6.6 7.4 7.4 0 1 0 17.4 15.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3.8v2M12 18.2v2M4.8 12h2M17.2 12h2M6.9 6.9l1.4 1.4M15.7 15.7l1.4 1.4M17.1 6.9l-1.4 1.4M8.3 15.7l-1.4 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export function FreeResultV2ManagementIcon({ type = "moisture" }) {
  if (type === "oil") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M6 15.5c1.8-1.3 3.6-1.3 5.4 0s3.6 1.3 5.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7.2 10.2c1.4-.9 2.8-.9 4.2 0 1.4.9 2.8.9 4.2 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.72" />
      </svg>
    );
  }

  if (type === "comfort") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4.4c3 3.5 5.1 6.4 5.1 9.1a5.1 5.1 0 0 1-10.2 0c0-2.7 2.1-5.6 5.1-9.1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.3 14.2c1.7 1.2 3.7 1.2 5.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
      </svg>
    );
  }

  if (type === "texture") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M5.5 8.5h13M5.5 12h13M5.5 15.5h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 6.5v2M16 14.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.72" />
      </svg>
    );
  }

  if (type === "refine") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M5.5 14.5c4.6-.5 8.2-3.3 10.9-8.3 1 5.6-.8 9.7-4.9 11.1-2 .7-4 .1-6-2.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.2 14.2c1.5-1.3 3-2.2 4.6-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.78" />
      </svg>
    );
  }

  if (type === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4.5 18 7v5.2c0 3.4-2.2 5.9-6 7.3-3.8-1.4-6-3.9-6-7.3V7l6-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m9.5 12 1.6 1.6 3.4-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
      </svg>
    );
  }

  if (type === "signal") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4v6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 14.7v.1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M5.2 19h13.6L12 4.4 5.2 19Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 4.4c3 3.5 5.1 6.4 5.1 9.1a5.1 5.1 0 0 1-10.2 0c0-2.7 2.1-5.6 5.1-9.1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function FreeResultV2ExecutionGuideIcon({ type = "order" }) {
  if (type === "frequency") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <rect x="5" y="5.5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 4v3M16 4v3M5 10h14M9 14h1.5M13.5 14H15M9 17h1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "avoid") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 4v6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 14.7v.1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M5.2 19h13.6L12 4.4 5.2 19Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "alternative") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M7.5 7.5h9.2l-2-2M16.5 16.5H7.3l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 7.5c1.6 1.2 2.5 2.9 2.5 5M7.5 16.5A6.3 6.3 0 0 1 5 11.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "score") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M6 18V11M12 18V7M18 18v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "style") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="9.2" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.4 19.2c.8-3.4 3-5.1 5.6-5.1s4.8 1.7 5.6 5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M18.7 5.5v3M20.2 7h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "flare") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M12 5.2c2.4 2.6 4 4.9 4 7a4 4 0 0 1-8 0c0-2.1 1.6-4.4 4-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8.3 18.4c2.1 1.1 5.3 1.1 7.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.7" />
      </svg>
    );
  }

  if (type === "track") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M5.5 17.5c2.2-4.8 5-5.8 7.4-3.1 1.7 1.9 3.6 1.5 5.6-2.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 6.5h14M5 10h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.72" />
      </svg>
    );
  }

  if (type === "pdf") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M7 4.5h6.3L18 9.2v10.3H7V4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M13 4.8V9h4.2M9.5 13h5M9.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M8 7.5h8M8 12h8M8 16.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 7.5h.1M5 12h.1M5 16.5h.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
