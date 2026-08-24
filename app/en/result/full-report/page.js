"use client";

import { useEffect, useState } from "react";
import FullReportPage from "../../../result/full-report/page";
import { localizeStoredProductsForEnglish } from "@/lib/product-localization-client";

export default function EnglishFullReportPage(props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let restore = () => {};

    void localizeStoredProductsForEnglish()
      .then((restoreLocalizedStorage) => {
        restore = restoreLocalizedStorage;
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      restore();
    };
  }, []);

  if (!ready) return null;

  return <FullReportPage {...props} />;
}
