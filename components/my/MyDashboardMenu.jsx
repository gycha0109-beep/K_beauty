"use client";

import AppHamburgerMenu from "@/components/navigation/AppHamburgerMenu";

export default function MyDashboardMenu() {
  return (
    <AppHamburgerMenu
      locale="ko"
      languageOptions={[
        { code: "ko", label: "한국어", href: "/my", active: true },
        { code: "en", label: "English", href: "/en" }
      ]}
      actions={[
        {
          label: "무료 진단 시작하기",
          href: "/"
        }
      ]}
      openLabel="My 메뉴 열기"
      closeLabel="My 메뉴 닫기"
      buttonClassName="bg-white/10 text-[#fff8f3] hover:bg-white/15"
      panelClassName="border-[#5a3a48] bg-[#241720]/96 text-[#fff8f3] shadow-[0_14px_36px_rgba(18,10,16,0.34)]"
    />
  );
}
