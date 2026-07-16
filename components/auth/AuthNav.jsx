"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LoginButtons from "@/components/auth/LoginButtons";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { buildAvatarInitials } from "@/lib/security/image-source-policy";
import { getCommonCopy } from "@/lib/ui/i18n";

function getAvatarInitials(user) {
  const metadata = user?.user_metadata || {};

  return buildAvatarInitials({
    displayName: metadata.name || metadata.full_name || metadata.preferred_username,
    email: user?.email
  });
}

function getVisibleUser(user) {
  if (!user || user.is_anonymous || user.app_metadata?.provider === "anonymous") {
    return null;
  }

  return user;
}

export default function AuthNav({ locale = "ko", showMyLink = true, showSignOut = true, menu = false }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isEnglish = locale === "en";
  const myPath = isEnglish ? "/en/my" : "/my";
  const copy = getCommonCopy(locale).auth;

  useEffect(() => {
    let isMounted = true;
    let supabase;

    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        setUser(error ? null : getVisibleUser(data?.user));
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUser(null);
        setIsLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(getVisibleUser(session?.user));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-9 w-full min-w-[104px] rounded-full border border-[#ead2ca] bg-white/40 dark:border-[#5a3a48] dark:bg-[#301f28]/50" />
    );
  }

  if (!user) {
    return (
      <LoginButtons
        compact
        label={copy.signInGoogle}
        loadingLabel={copy.connecting}
        next={myPath}
        locale={locale}
      />
    );
  }

  const avatarInitials = getAvatarInitials(user);

  return (
    <div className={menu ? "flex min-w-0 items-center justify-between gap-2" : "flex min-w-0 items-center justify-end gap-1.5 sm:gap-2"}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ead2ca] bg-white/90 text-[11px] font-semibold text-[#5a2d3c] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]"
        aria-label={isEnglish ? "User profile" : "사용자 프로필"}
        data-auth-avatar-state={avatarInitials ? "initials" : "generic"}
      >
        {avatarInitials || (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
            <path d="M5.5 19c.55-3.25 2.7-5 6.5-5s5.95 1.75 6.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {showMyLink ? (
        <Link
          href={myPath}
          className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#ead2ca] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#5a2d3c] transition hover:border-[#dbaea4] hover:bg-white dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df] dark:hover:border-[#6a4050] dark:hover:bg-[#352430]"
        >
          My
        </Link>
      ) : null}
      {showSignOut ? (
        <a
          href="/api/auth/signout"
          className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#ead2ca] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#7d5361] transition hover:border-[#dbaea4] hover:bg-white dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#c8aeb8] dark:hover:border-[#6a4050] dark:hover:bg-[#352430]"
        >
          {copy.signOut}
        </a>
      ) : null}
    </div>
  );
}
