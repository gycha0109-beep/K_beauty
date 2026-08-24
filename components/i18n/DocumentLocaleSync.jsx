"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { resolveDocumentLocale } from "@/lib/document-locale";

export default function DocumentLocaleSync() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = resolveDocumentLocale(pathname);
  }, [pathname]);

  return null;
}
