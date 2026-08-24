"use client";

import { useEffect, useState } from "react";
import FullReportPage from "../../../result/full-report/page";
import {
  installEnglishFullReportResponseLocalization,
  localizeStoredProductsForEnglish
} from "@/lib/product-localization-client";

export default function EnglishFullReportPage(props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let restoreStorage = () => {};
    const restoreFetch = installEnglishFullReportResponseLocalization();

    void localizeStoredProductsForEnglish()
      .then((restoreLocalizedStorage) => {
        restoreStorage = restoreLocalizedStorage;
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      restoreStorage();
      restoreFetch();
    };
  }, []);

  if (!ready) return null;

  return <FullReportPage {...props} />;
}
