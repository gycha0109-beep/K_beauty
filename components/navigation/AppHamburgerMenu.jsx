"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import AuthNav from "@/components/auth/AuthNav";
import { getCommonCopy } from "@/lib/ui/i18n";

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function AppHamburgerMenu({
  locale = "ko",
  languageOptions,
  showLanguage = true,
  showAccount = true,
  showTheme = true,
  actions = [],
  openLabel,
  closeLabel,
  buttonClassName = "",
  panelClassName = "",
  themeToggleClassName = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const commonCopy = getCommonCopy(locale);
  const navigationCopy = commonCopy.navigation;
  const resolvedOpenLabel = openLabel || navigationCopy.openMenu;
  const resolvedCloseLabel = closeLabel || navigationCopy.closeMenu;
  const resolvedLanguageOptions = languageOptions || [
    { code: "ko", label: navigationCopy.languages.ko, href: "/" },
    { code: "en", label: navigationCopy.languages.en, href: "/en" }
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);
  const hasLanguage = showLanguage && resolvedLanguageOptions.length > 0;
  const hasActions = actions.length > 0;

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={isOpen ? resolvedCloseLabel : resolvedOpenLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={cx(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ead9d6] bg-white/85 text-[#203755] shadow-sm transition hover:border-[#dbaea4] hover:bg-white dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]",
          buttonClassName
        )}
      >
        {isOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {isOpen ? (
        <div
          className={cx(
            "absolute right-0 z-30 mt-2 w-[min(16.5rem,calc(100vw-2rem))] rounded-[1rem] border border-[#ead9d6] bg-white/95 p-2.5 text-[#26101a] shadow-[0_14px_36px_rgba(38,16,26,0.14)] backdrop-blur dark:border-[#5a3a48] dark:bg-[#241720]/95 dark:text-[#fff8f3]",
            panelClassName
          )}
        >
          {hasLanguage ? (
            <div>
              <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9a6c78] dark:text-[#c8aeb8]">
                {navigationCopy.language}
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {resolvedLanguageOptions.map((item) => {
                  const active = item.active ?? locale === item.code;
                  return (
                    <Link
                      key={item.code}
                      href={item.href}
                      onClick={closeMenu}
                      className={cx(
                        "inline-flex min-h-8 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold transition",
                        active
                          ? "bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] text-white"
                          : "border border-[#ead9d6] bg-white/70 text-[#7a5360] hover:bg-white dark:border-[#5a3a48] dark:bg-[#301f28]/80 dark:text-[#f4d7df]"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showAccount ? (
            <div className={cx(hasLanguage ? "mt-2 border-t border-[#f0ddd6] pt-2 dark:border-[#4a303c]" : "")}>
              <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9a6c78] dark:text-[#c8aeb8]">
                {navigationCopy.account}
              </p>
              <div className="mt-1.5">
                <AuthNav locale={locale} showMyLink={false} menu />
              </div>
            </div>
          ) : null}

          {showTheme ? (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#f0ddd6] pt-2 dark:border-[#4a303c]">
              <span className="px-1 text-[11px] font-semibold text-[#6e4050] dark:text-[#f4d7df]">
                {navigationCopy.theme}
              </span>
              <ThemeToggle
                locale={locale}
                compact
                className={cx("h-8 min-h-8 px-3 text-[11px]", themeToggleClassName)}
              />
            </div>
          ) : null}

          {hasActions ? (
            <div className="mt-2 space-y-1.5 border-t border-[#f0ddd6] pt-2 dark:border-[#4a303c]">
              {actions.map((action) => {
                const className = cx(
                  "flex min-h-8 w-full items-center justify-center rounded-full border border-[#ead9d6] bg-white/60 px-3 text-[11px] font-semibold text-[#5a2d3c] transition hover:bg-white dark:border-[#5a3a48] dark:bg-[#301f28]/75 dark:text-[#f4d7df] dark:hover:bg-[#352430]",
                  action.className
                );

                if (action.href) {
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      onClick={(event) => {
                        action.onClick?.(event);
                        if (!event.defaultPrevented) {
                          closeMenu();
                        }
                      }}
                      className={className}
                    >
                      {action.label}
                    </Link>
                  );
                }

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={(event) => {
                      action.onClick?.(event);
                      closeMenu();
                    }}
                    className={className}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
