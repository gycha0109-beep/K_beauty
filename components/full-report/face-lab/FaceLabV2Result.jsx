"use client";

import { useMemo } from "react";
import { buildFaceLabV2ResultPresentation } from "@/lib/face-lab-v2/result-presentation";

function List({ items }) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <div className="mt-3 grid gap-2">
      {safe.map((item, index) => (
        <div
          key={`${index}-${item}`}
          className="rounded-xl border border-zinc-200 bg-white/60 px-3 py-2.5 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950/30"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function MetaGrid({ items }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg bg-black/[0.035] px-2.5 py-2 dark:bg-white/[0.045]">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-55">{item.label}</p>
          <p className="mt-1 text-xs font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function FaceLabV2Result({
  result,
  locale = "ko",
  onSelectRoute,
  onEditTarget
}) {
  const view = useMemo(
    () => buildFaceLabV2ResultPresentation(result, { locale }),
    [result, locale]
  );

  if (view.status === "unavailable") {
    return (
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">FACE LAB V2</p>
        <h2 className="ui-title mt-2 text-xl">{view.notice?.title}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{view.notice?.body}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui-kicker">FACE LAB V2</p>
            <h2 className="ui-title mt-2 text-xl">{view.current.title}</h2>
            <p className="ui-text-secondary mt-2 text-sm leading-6">{view.current.summary}</p>
          </div>
          <button
            type="button"
            onClick={onEditTarget}
            className="ui-button-secondary shrink-0 px-3 py-2 text-xs font-semibold"
          >
            {locale === "en" ? "Edit target" : "추구미 수정"}
          </button>
        </div>

        {view.current.features.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {view.current.features.map((feature) => (
              <div key={feature.id} className="ui-card-subtle p-3">
                <p className="text-sm font-semibold">{feature.title}</p>
                {feature.body ? (
                  <p className="ui-text-secondary mt-1 text-xs leading-5">{feature.body}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ui-card-subtle p-5 sm:p-6">
        <p className="ui-kicker">{view.target.title}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {view.target.labels.map((label) => (
            <span key={label} className="ui-choice-active rounded-full px-3 py-1.5 text-sm font-semibold">
              {label}
            </span>
          ))}
        </div>
        <p className="ui-text-secondary mt-3 text-sm leading-6">{view.target.summary}</p>
      </section>

      {view.notice ? (
        <section className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/15 sm:p-6">
          <p className="text-sm font-semibold">{view.notice.title}</p>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{view.notice.body}</p>
        </section>
      ) : null}

      {view.changes.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{view.changesTitle}</p>
          <div className="mt-3 grid gap-2">
            {view.changes.map((change, index) => (
              <div
                key={change.id}
                className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold opacity-45">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-xs font-semibold text-zinc-500">{change.domainLabel}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-6">{change.title}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view.routes.cards.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
        <p className="ui-kicker">{view.routes.title}</p>
        <div className="mt-3 grid gap-3">
          {view.routes.cards.map((route) => (
            <button
              key={route.routeId}
              type="button"
              onClick={() => onSelectRoute(route.routeId)}
              className={`rounded-xl border p-4 text-left transition ${
                route.selected
                  ? "ui-choice-active"
                  : "border-zinc-200 bg-white/60 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{route.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-85">{route.summary}</p>
                </div>
                {route.fitLabel ? (
                  <span className="shrink-0 rounded-full border border-current/15 px-2 py-1 text-[10px] font-semibold opacity-70">
                    {route.fitLabel}
                  </span>
                ) : null}
              </div>

              <MetaGrid items={route.meta} />

              {route.actions.length ? (
                <div className="mt-3 grid gap-1.5">
                  {route.actions.map((action) => (
                    <p key={action} className="text-xs leading-5 opacity-75">· {action}</p>
                  ))}
                </div>
              ) : null}

              {route.targetFit ? (
                <p className="mt-3 text-xs font-medium leading-5 opacity-65">{route.targetFit}</p>
              ) : null}

              {route.tradeoffs.length ? (
                <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2">
                  {route.tradeoffs.map((item) => (
                    <p key={item} className="text-xs leading-5">{item}</p>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
        </section>
      ) : null}

      {view.execution.domains.length ? (
        <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{view.execution.title}</p>
        {view.execution.routeTitle ? (
          <h3 className="ui-title mt-2 text-lg">{view.execution.routeTitle}</h3>
        ) : null}

        <div className="mt-5 grid gap-5">
          {view.execution.domains.map((domain, index) => (
            <div key={domain.domain}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold opacity-40">{String(index + 1).padStart(2, "0")}</span>
                <h4 className="text-sm font-semibold">{domain.title}</h4>
              </div>
              <List items={domain.actions} />
            </div>
          ))}
        </div>
        </section>
      ) : null}

      {view.conflicts.items.length ? (
        <section className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/15 sm:p-6">
          <p className="ui-kicker">{view.conflicts.title}</p>
          <div className="mt-3 grid gap-3">
            {view.conflicts.items.map((item) => (
              <div key={item.id}>
                <p className="text-sm font-semibold leading-6">{item.description}</p>
                {item.resolution ? (
                  <p className="ui-text-secondary mt-1 text-sm leading-6">→ {item.resolution}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view.look ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{view.look.title}</p>
          <h3 className="ui-title mt-2 text-lg">{view.look.routeTitle}</h3>
          {view.look.summary ? (
            <p className="ui-text-secondary mt-2 text-sm leading-6">{view.look.summary}</p>
          ) : null}
          {view.look.why ? (
            <p className="mt-3 rounded-xl border border-zinc-200 bg-white/60 px-3 py-2.5 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950/30">
              {view.look.why}
            </p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {view.look.pieces.map((piece) => (
              <div key={piece.domain} className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-xs font-semibold text-zinc-500">{piece.title}</p>
                <p className="mt-1 text-sm leading-6">{piece.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view.productGuides.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{view.productTitle}</p>
          <div className="mt-3 grid gap-3">
            {view.productGuides.map((guide) => (
              <div key={guide.specId} className="rounded-xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-sm font-semibold">{guide.category}</p>

                {guide.recommended.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-zinc-500">{guide.recommendedLabel}</p>
                    <List items={guide.recommended.map((item) => `✓ ${item}`)} />
                  </div>
                ) : null}

                {guide.avoid.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-zinc-500">{guide.avoidLabel}</p>
                    <List items={guide.avoid.map((item) => `– ${item}`)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view.archetype ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{view.archetype.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.archetype.items.map((item) => (
              <span
                key={item.key}
                className={item.emphasis === "primary"
                  ? "ui-choice-active rounded-full px-3 py-1.5 text-sm font-semibold"
                  : "ui-chip-compact px-3 py-1.5"}
              >
                {item.label}
              </span>
            ))}
          </div>
          <p className="ui-text-secondary mt-3 text-xs leading-5">{view.archetype.disclaimer}</p>
        </section>
      ) : null}
    </section>
  );
}
