"use client";

import { useState } from "react";
import {
  FreeResultV2Card,
  FreeResultV2LockIcon,
  FreeResultV2ManagementIcon,
  FreeResultV2StepFrame
} from "@/components/result/free-v2/FreeResultV2Primitives";

export default function FreeResultV2RecommendationValidationStep({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const [activeSignalTab, setActiveSignalTab] = useState("fit");
  const signalGroups = isEnglish
    ? [
        {
          key: "fit",
          label: "Good signs",
          icon: "comfort",
          items: [
            { key: "oil", title: "Afternoon shine rises more slowly", body: "A sign that oil and moisture are balancing better.", icon: "oil" },
            { key: "comfort", title: "Tightness after cleansing feels lower", body: "A sign that moisture is holding for longer.", icon: "comfort" },
            { key: "dry", title: "Cheek dryness feels calmer", body: "A sign that the moisture step is fitting without burden.", icon: "moisture" }
          ]
        },
        {
          key: "adjust",
          label: "Adjustment signs",
          icon: "signal",
          items: [
            { key: "dry", title: "Dryness gets stronger", body: "The moisture step may be insufficient or the amount may be too much.", icon: "moisture" },
            { key: "red", title: "Stinging or redness appears", body: "Active products may be irritating, so pause them for a bit.", icon: "signal" },
            { key: "cleanse", title: "Stronger cleansing increases", body: "Trying to control shine can disrupt the balance further.", icon: "oil" }
          ]
        }
      ]
    : [
        {
          key: "fit",
          label: "잘 맞는 신호",
          icon: "comfort",
          items: [
            { key: "oil", title: "오후 번들거림이 덜 빨리 올라옴", body: "유분과 수분 균형이 안정되는 쪽으로 가고 있다는 신호예요.", icon: "oil" },
            { key: "comfort", title: "세안 후 당김이 줄어듦", body: "수분감이 더 오래 유지되고 있다는 뜻이에요.", icon: "comfort" },
            { key: "dry", title: "볼 주변 건조감이 편해짐", body: "수분 보강이 피부에 부담 없이 이어지고 있어요.", icon: "moisture" }
          ]
        },
        {
          key: "adjust",
          label: "조정 신호",
          icon: "signal",
          items: [
            { key: "dry", title: "건조함이 심해짐", body: "수분 단계가 부족하거나 사용량이 과할 수 있어요.", icon: "moisture" },
            { key: "red", title: "따가움·붉어짐 발생", body: "기능성 제품이 자극이 될 수 있어 잠시 쉬는 편이 좋아요.", icon: "signal" },
            { key: "cleanse", title: "강한 세안이 늘어남", body: "번들거림을 잡는 과정에서 균형이 무너질 수 있어요.", icon: "oil" }
          ]
        }
      ];
  const activeSignalGroup = signalGroups.find((group) => group.key === activeSignalTab) || signalGroups[0];
  const lockedItems = isEnglish
    ? ["Situation adjustments", "Frequency guide", "Combinations to avoid", "Matched alternatives"]
    : ["상황별 조정법", "사용 빈도 가이드", "피해야 할 조합", "맞춤 대체 제품"];

  return (
    <FreeResultV2StepFrame
      title={isEnglish ? "Check If the Recommendation Fits" : "추천이 맞는지 확인하기"}
      body={isEnglish ? "These signs show whether the current recommendation fits your skin." : "이 신호를 보면 지금 추천이 내 피부에 맞고 있는지 알 수 있어요."}
    >
      <FreeResultV2Card className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-[1.15rem] border border-[#ead9d6] bg-white/28 p-1 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
          {signalGroups.map((group) => {
            const isActive = group.key === activeSignalGroup.key;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setActiveSignalTab(group.key)}
                className={`inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[linear-gradient(135deg,#f45f88,#ff7b68)] text-white shadow-[0_14px_28px_rgba(230,80,122,0.22)]"
                    : "text-[#7a5360] hover:bg-white/40 dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
                }`}
                aria-pressed={isActive}
              >
                <FreeResultV2ManagementIcon type={group.icon} />
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[1.35rem] border border-[#ead9d6] bg-white/28 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
          {activeSignalGroup.items.map((item, index) => (
            <div key={item.key} className={`flex items-start gap-3 px-3.5 py-3.5 ${index ? "border-t border-[#ead9d6]/80 dark:border-[#5a3a48]" : ""}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                activeSignalGroup.key === "fit"
                  ? "border-[#8bd9b2]/30 bg-[#8bd9b2]/14 text-[#8bd9b2]"
                  : "border-[#ff8fa3]/32 bg-[#ff8fa3]/14 text-[#ff8fa3]"
              }`}>
                <FreeResultV2ManagementIcon type={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item.title}</span>
                <span className="mt-1 block break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{item.body}</span>
              </span>
            </div>
          ))}
        </div>
      </FreeResultV2Card>

      <FreeResultV2Card className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/32 bg-[#ff9aa8]/10 text-[#ff9aa8]">
            <FreeResultV2LockIcon />
          </span>
          <div className="min-w-0">
            <p className="break-keep text-base font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
              {isEnglish ? "Unlocked in the full report" : "전체 리포트에서 열리는 내용"}
            </p>
            <p className="mt-1 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
              {isEnglish ? "Continue with sensitive-day changes and product frequency." : "민감해진 날부터 제품 사용 빈도까지 이어서 확인할 수 있어요."}
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.15rem] border border-[#ead9d6] bg-white/28 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
          {lockedItems.map((item) => (
            <div key={item} className="flex items-center gap-3 border-t border-[#ead9d6]/80 px-3.5 py-3 first:border-t-0 dark:border-[#5a3a48]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/28 bg-[#ff9aa8]/10 text-[#ff9aa8]">
                <FreeResultV2LockIcon />
              </span>
              <span className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item}</span>
            </div>
          ))}
        </div>
      </FreeResultV2Card>
    </FreeResultV2StepFrame>
  );
}
