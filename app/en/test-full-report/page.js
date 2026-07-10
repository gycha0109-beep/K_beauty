"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FullReportPage from "@/app/result/full-report/page";
import { seedTestResultSession } from "@/lib/test-result-fixture";

export default function EnglishTestFullReportPage() {
  const router = useRouter();
  const [seeded, setSeeded] = useState(false);
  const [functionalPlanDevScenarios, setFunctionalPlanDevScenarios] = useState([]);

  useEffect(() => {
    let cancelled = false;

    if (process.env.NODE_ENV === "production") {
      router.replace("/en");
      return () => {
        cancelled = true;
      };
    }

    seedTestResultSession();

    import("@/lib/functional-plan-dev-fixtures")
      .then((module) => {
        if (cancelled) {
          return;
        }

        setFunctionalPlanDevScenarios(module.FUNCTIONAL_PLAN_DEV_SCENARIOS || []);
        setSeeded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFunctionalPlanDevScenarios([]);
          setSeeded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!seeded) {
    return null;
  }

  return <FullReportPage functionalPlanDevScenarios={functionalPlanDevScenarios} />;
}
