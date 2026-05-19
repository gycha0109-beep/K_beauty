"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResultPage from "@/app/result/page";
import { seedTestResultSession } from "@/lib/test-result-fixture";

export default function TestResultPage() {
  const router = useRouter();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      router.replace("/");
      return;
    }

    seedTestResultSession();
    setSeeded(true);
  }, [router]);

  if (!seeded) {
    return null;
  }

  return <ResultPage />;
}
