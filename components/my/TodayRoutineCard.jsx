import { getMyCopy } from "@/lib/my/i18n";

function normalizeTextList(values) {
  return Array.isArray(values) ? values.filter(Boolean).map(String) : [];
}

const CARE_RULES = {
  ko: [
    {
      key: "active_rest",
      type: "caution",
      priority: 10,
      match: ({ avoidItems }) => avoidItems.some((item) => /각질|레티놀|비타민C|강한 클렌징/.test(item)),
      text: "오늘은 각질·강한 기능성 단계를 쉬세요."
    },
    {
      key: "new_product_pause",
      type: "caution",
      priority: 12,
      match: ({ avoidItems }) => avoidItems.some((item) => /새 제품|동시 테스트/.test(item)),
      text: "새 제품을 한 번에 테스트하지 마세요."
    },
    {
      key: "gentle_cleanse",
      type: "adjustment",
      priority: 20,
      match: ({ reduceItems, keepItems }) =>
        reduceItems.some((item) => /클렌저|세안/.test(item)) ||
        keepItems.some((item) => /저자극/.test(item)),
      text: "세안은 자극 적은 방식으로 유지하세요."
    },
    {
      key: "moisture_hold",
      type: "adjustment",
      priority: 30,
      match: ({ keepItems }) => keepItems.some((item) => /보습|장벽|수분|진정/.test(item)),
      text: "보습 단계를 건너뛰지 마세요."
    },
    {
      key: "light_layers",
      type: "adjustment",
      priority: 40,
      match: ({ reduceItems }) => reduceItems.some((item) => /무거운|레이어링|끈적|밀림/.test(item)),
      text: "무거운 레이어는 줄이고 가볍게 마무리하세요."
    },
    {
      key: "sun_protection",
      type: "adjustment",
      priority: 50,
      match: ({ keepItems }) => keepItems.some((item) => /선크림|덧바름/.test(item)),
      text: "선크림은 충분히 바르고 필요하면 덧바르세요."
    }
  ],
  en: [
    {
      key: "active_rest",
      type: "caution",
      priority: 10,
      match: ({ avoidItems }) => avoidItems.some((item) => /exfoliat|retinol|vitamin|strong cleanse|각질|레티놀|비타민|강한 클렌징/i.test(item)),
      text: "Pause exfoliating or stronger active steps today."
    },
    {
      key: "new_product_pause",
      type: "caution",
      priority: 12,
      match: ({ avoidItems }) => avoidItems.some((item) => /new product|test|새 제품|동시 테스트/i.test(item)),
      text: "Do not test several new products at once."
    },
    {
      key: "gentle_cleanse",
      type: "adjustment",
      priority: 20,
      match: ({ reduceItems, keepItems }) =>
        reduceItems.some((item) => /cleanse|cleanser|클렌저|세안/.test(item.toLowerCase())) ||
        keepItems.some((item) => /low irritation|gentle|저자극/.test(item.toLowerCase())),
      text: "Keep cleansing gentle today."
    },
    {
      key: "moisture_hold",
      type: "adjustment",
      priority: 30,
      match: ({ keepItems }) => keepItems.some((item) => /moist|barrier|hydration|calm|보습|장벽|수분|진정/.test(item.toLowerCase())),
      text: "Do not skip the moisture step."
    },
    {
      key: "light_layers",
      type: "adjustment",
      priority: 40,
      match: ({ reduceItems }) => reduceItems.some((item) => /heavy|layer|sticky|pill|무거운|레이어링|끈적|밀림/.test(item.toLowerCase())),
      text: "Reduce heavy layers and keep the finish light."
    },
    {
      key: "sun_protection",
      type: "adjustment",
      priority: 50,
      match: ({ keepItems }) => keepItems.some((item) => /sunscreen|reapply|sun|선크림|덧바름/.test(item.toLowerCase())),
      text: "Keep sunscreen in place and reapply if needed."
    }
  ]
};

const FALLBACK_CARE = {
  ko: "기본 보습과 선크림만 안정적으로 유지하세요.",
  en: "Keep basic moisture and sunscreen steady."
};

function getCareLocale(copy) {
  return copy.locale === "en" ? "en" : "ko";
}

function buildCareSummary(routine, copy) {
  const locale = getCareLocale(copy);
  const keepItems = normalizeTextList(routine?.keep_items);
  const reduceItems = normalizeTextList(routine?.reduce_items);
  const avoidItems = normalizeTextList(routine?.avoid_items);
  const context = { keepItems, reduceItems, avoidItems };
  const matched = CARE_RULES[locale]
    .filter((rule) => rule.match(context))
    .sort((left, right) => left.priority - right.priority);

  const seen = new Set();
  const unique = matched.filter((rule) => {
    if (seen.has(rule.key)) {
      return false;
    }
    seen.add(rule.key);
    return true;
  });
  const caution = unique.find((rule) => rule.type === "caution");
  const adjustments = unique.filter((rule) => rule.type === "adjustment").slice(0, 2);

  if (!adjustments.length) {
    adjustments.push({
      key: "basic",
      type: "adjustment",
      priority: 99,
      text: FALLBACK_CARE[locale]
    });
  }

  return {
    adjustments,
    caution: caution || null
  };
}

function ActionList({ title, items, tone = "neutral" }) {
  const toneClassName = {
    adjustment: "border-[#d9c4a8] bg-[#fff8ef] dark:border-[#6a4a25] dark:bg-[#332314]",
    reduce: "border-[#ead2ca] bg-white/70 dark:border-[#4a303c] dark:bg-[#2f202a]",
    caution: "border-[#e0b9b0] bg-[#fff3ee] dark:border-[#6a4050] dark:bg-[#351f28]",
    neutral: "border-[#ead2ca] bg-white/70 dark:border-[#4a303c] dark:bg-[#2f202a]"
  }[tone];

  return (
    <div className={`rounded-[1rem] border p-4 ${toneClassName}`}>
      <p className="ui-text-primary text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 ui-text-secondary">
        {items.map((item) => (
          <li key={item.key} className="break-words">{item.text}</li>
        ))}
      </ul>
    </div>
  );
}

export default function TodayRoutineCard({ routine, copy = getMyCopy("ko") }) {
  const careSummary = buildCareSummary(routine, copy);
  const hasCaution = Boolean(careSummary.caution);

  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">{copy.routine.kicker}</p>
      <h2 className="ui-title mt-2 text-2xl sm:text-3xl">{copy.routine.title}</h2>
      {copy.routine.body ? (
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.routine.body}</p>
      ) : null}

      <div className={`mt-5 grid gap-3 ${hasCaution ? "md:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]" : ""}`}>
        <ActionList title={copy.routine.adjustments} items={careSummary.adjustments} tone="adjustment" />
        {hasCaution ? (
          <ActionList title={copy.routine.caution} items={[careSummary.caution]} tone="caution" />
        ) : null}
      </div>

      <div className="mt-5 rounded-[1rem] border border-[#ead2ca] bg-white/55 p-4 dark:border-[#4a303c] dark:bg-[#2f202a]/70">
        <p className="ui-text-secondary text-sm leading-6">
          {copy.routine.detailsBody}
        </p>
      </div>
    </section>
  );
}
