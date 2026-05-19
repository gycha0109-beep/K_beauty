"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FullReportPage from "@/app/result/full-report/page";
import { seedTestResultSession } from "@/lib/test-result-fixture";

export default function EnglishTestFullReportPage() {
  const router = useRouter();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      router.replace("/en");
      return;
    }

    seedTestResultSession();
    setSeeded(true);
  }, [router]);

  if (!seeded) {
    return null;
  }

  return <FullReportPage />;
}
