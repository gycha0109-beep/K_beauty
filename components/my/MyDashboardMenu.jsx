"use client";

import AppHamburgerMenu from "@/components/navigation/AppHamburgerMenu";
import { getMyCopy } from "@/lib/my/i18n";

export default function MyDashboardMenu({ locale = "ko" }) {
  const copy = getMyCopy(locale);

  return (
    <AppHamburgerMenu
      locale={locale}
      languageOptions={[
        { code: "ko", label: copy.menu.languages.ko, href: "/my", active: locale !== "en" },
        { code: "en", label: copy.menu.languages.en, href: "/en/my", active: locale === "en" }
      ]}
      showAccountIdentity
      actions={[
        {
          label: copy.menu.startAnalysis,
          href: copy.paths.home
        }
      ]}
      openLabel={copy.menu.open}
      closeLabel={copy.menu.close}
      buttonClassName="bg-white/10 text-[#fff8f3] hover:bg-white/15"
      panelClassName="border-[#5a3a48] bg-[#241720]/96 text-[#fff8f3] shadow-[0_14px_36px_rgba(18,10,16,0.34)]"
    />
  );
}
