"use client";

import { useEffect, useState } from "react";
import ResultPage from "../../result/page";
import { localizeStoredProductsForEnglish } from "@/lib/product-localization-client";

export default function EnglishResultPage() {
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

  return <ResultPage />;
}
