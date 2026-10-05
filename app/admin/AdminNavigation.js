"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";

const NAVIGATION = Object.freeze([
  {
    label: "개요",
    href: "/admin",
    capability: ADMIN_CAPABILITIES.DASHBOARD_READ
  },
  {
    label: "제품 리뷰",
    href: "/admin/products/reviews",
    capability: ADMIN_CAPABILITIES.PRODUCTS_READ,
    exact: true
  },
  {
    label: "제품 신뢰 검토",
    href: "/admin/products/trust",
    capability: ADMIN_CAPABILITIES.PRODUCTS_READ
  },
  {
    label: "리뷰 가져오기",
    href: "/admin/products/reviews/import",
    capability: ADMIN_CAPABILITIES.PRODUCTS_REVIEW
  },
  { label: "피부 맞춤 추천", href: null },
  { label: "얼굴 분석", href: null },
  { label: "사용자 및 신고", href: null },
  { label: "개인정보", href: null },
  { label: "시스템", href: null }
]);

function isActivePath(pathname, href, exact = false) {
  if (href === "/admin" || exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNavigation({ capabilities = [] }) {
  const pathname = usePathname();
  const grantedCapabilities = new Set(capabilities);

  return (
    <nav
      aria-label="관리자 메뉴"
      className="mt-6 grid gap-1 sm:grid-cols-2 lg:grid-cols-1"
    >
      {NAVIGATION.map((item) => {
        if (
          item.href &&
          item.capability &&
          !grantedCapabilities.has(item.capability)
        ) {
          return null;
        }

        if (!item.href) {
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#8a919d]"
            >
              {item.label}
              <span className="ml-2 text-[10px] uppercase tracking-[0.12em]">
                준비 중
              </span>
            </span>
          );
        }

        const active = isActivePath(pathname, item.href, item.exact);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-xl bg-[#171a20] px-3 py-2.5 text-sm font-semibold text-white dark:bg-[#f2f4f7] dark:text-[#171a20]"
                : "rounded-xl px-3 py-2.5 text-sm font-medium text-[#59616d] transition hover:bg-[#f2f4f7] dark:text-[#c2c8d1] dark:hover:bg-[#20242b]"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
