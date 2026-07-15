"use client";

import Link from "next/link";

const VARIANT_COPY = {
  analysis_failed: {
    title: "분석을 완료하지 못했어요",
    description:
      "사진과 답변은 전달됐지만, 일시적인 문제로 결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
    primaryActionLabel: "다시 분석하기",
    primaryActionHref: "/",
    secondaryActionLabel: "처음으로 돌아가기",
    secondaryActionHref: "/"
  },
  result_empty: {
    title: "결과를 찾을 수 없어요",
    description:
      "이전에 만든 결과가 만료되었거나 저장되지 않은 상태일 수 있습니다. 새로 진단하면 다시 리포트를 받을 수 있습니다.",
    primaryActionLabel: "새로 진단하기",
    primaryActionHref: "/",
    secondaryActionLabel: "저장된 결과 보러가기"
  },
  not_found: {
    title: "페이지를 찾을 수 없어요",
    description: "주소가 잘못되었거나 삭제된 리포트일 수 있습니다.",
    primaryActionLabel: "홈으로 돌아가기",
    primaryActionHref: "/"
  },
  payment_failed: {
    title: "결제를 완료하지 못했어요",
    description: "일시적인 오류로 결제가 정상 처리되지 않았습니다. 다시 시도해 주세요.",
    primaryActionLabel: "다시 결제하기",
    primaryActionHref: "/",
    secondaryActionLabel: "이전 페이지로 돌아가기",
    secondaryActionHref: "/"
  },
  save_failed: {
    title: "결과를 저장하지 못했어요",
    description: "네트워크 상태나 일시적인 문제로 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    primaryActionLabel: "다시 저장하기",
    primaryActionHref: "/result",
    secondaryActionLabel: "결과로 돌아가기",
    secondaryActionHref: "/result"
  },
  empty: {
    title: "아직 보여줄 내용이 없어요",
    description: "새로 진단하면 비주얼리 리포트를 다시 받을 수 있습니다.",
    primaryActionLabel: "새로 진단하기",
    primaryActionHref: "/"
  }
};

const LOGO_LIGHT_SRC = "/images/brand/bejewely-icon-light.png";
const LOGO_DARK_SRC = "/images/brand/bejewely-icon-dark.png";

function ActionLink({ href, label, tone = "primary" }) {
  if (!href || !label) {
    return null;
  }

  const className =
    tone === "primary"
      ? "flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#db7d86] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_10px_22px_rgba(190,88,106,0.18)] transition hover:bg-[#cf727d] focus:outline-none focus:ring-2 focus:ring-[#de9aa1] focus:ring-offset-2 focus:ring-offset-[#fffaf7] dark:bg-[#e99aa1] dark:text-[#211519] dark:shadow-[0_10px_22px_rgba(233,154,161,0.12)] dark:hover:bg-[#f0aab0] dark:focus:ring-[#efb0b6] dark:focus:ring-offset-[#17171a]"
      : "flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#e6c5bf] bg-white/45 px-5 py-3 text-center text-sm font-semibold text-[#4d2a31] transition hover:border-[#daa9a3] hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#e3b6b0] focus:ring-offset-2 focus:ring-offset-[#fffaf7] dark:border-[#7a5358] dark:bg-transparent dark:text-[#f6e9e3] dark:hover:border-[#9b6d72] dark:hover:bg-white/[0.04] dark:focus:ring-[#9b6d72] dark:focus:ring-offset-[#17171a]";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export default function ErrorState({
  variant = "empty",
  title,
  description,
  primaryActionLabel,
  primaryActionHref,
  primaryActionContent,
  secondaryActionLabel,
  secondaryActionHref
}) {
  const preset = VARIANT_COPY[variant] || VARIANT_COPY.empty;
  const displayTitle = title === undefined ? preset.title : title;
  const displayDescription = description === undefined ? preset.description : description;
  const primaryLabel = primaryActionLabel === undefined ? preset.primaryActionLabel : primaryActionLabel;
  const primaryHref = primaryActionHref === undefined ? preset.primaryActionHref : primaryActionHref;
  const secondaryLabel = secondaryActionLabel === undefined ? preset.secondaryActionLabel : secondaryActionLabel;
  const secondaryHref = secondaryActionHref === undefined ? preset.secondaryActionHref : secondaryActionHref;

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#fbf2ed] px-5 py-10 text-[#2c171b] dark:bg-[#17171a] dark:text-[#fff8f0]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_8%,rgba(224,126,137,0.16),transparent_34%),linear-gradient(180deg,#fff8f4_0%,#f8ede8_48%,#f1e1dc_100%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(230,142,151,0.14),transparent_32%),linear-gradient(180deg,#1b1718_0%,#17171a_55%,#141316_100%)]" />
      <section className="w-full max-w-[420px] -translate-y-6 rounded-[30px] border border-[#efd7d1] bg-[#fffaf7]/95 px-6 py-8 text-center shadow-[0_18px_48px_rgba(88,42,50,0.08)] dark:border-[#4d373b] dark:bg-[#1f1b1d]/95 dark:shadow-[0_20px_52px_rgba(0,0,0,0.24)] sm:max-w-[480px] sm:-translate-y-7 sm:px-8 sm:py-9">
        <div className="mx-auto flex h-48 w-full items-center justify-center overflow-hidden">
          <img
            src={LOGO_LIGHT_SRC}
            alt="Bejewely"
            className="block h-56 w-56 object-cover dark:hidden"
            width="224"
            height="224"
          />
          <img
            src={LOGO_DARK_SRC}
            alt="Bejewely"
            className="hidden h-56 w-56 object-cover dark:block"
            width="224"
            height="224"
          />
        </div>

        <h1 className="mt-7 text-[26px] font-bold leading-[1.28] text-[#211519] dark:text-[#fff8f0] sm:text-[28px]">
          {displayTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-[340px] text-sm font-medium leading-7 text-[#5f454b] dark:text-[#e7d8d1] sm:text-[15px]">
          {displayDescription}
        </p>

        <div className="mt-8 flex flex-col gap-2.5">
          {primaryActionContent || <ActionLink href={primaryHref} label={primaryLabel} />}
          <ActionLink href={secondaryHref} label={secondaryLabel} tone="secondary" />
        </div>
      </section>
    </main>
  );
}
