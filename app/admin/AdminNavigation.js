"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";

const NAVIGATION = Object.freeze([
  {
    label: "Overview",
    href: "/admin",
    capability: ADMIN_CAPABILITIES.DASHBOARD_READ
  },
  {
    label: "Product reviews",
    href: "/admin/products/reviews",
    capability: ADMIN_CAPABILITIES.PRODUCTS_READ
  },
  { label: "Skin Match", href: null },
  { label: "Face Lab", href: null },
  { label: "Users & reports", href: null },
  { label: "Privacy", href: null },
  { label: "System", href: null }
]);

function isActivePath(pathname, href) {
  if (href === "/admin") {
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
                Later
              </span>
            </span>
          );
        }

        const active = isActivePath(pathname, item.href);

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
