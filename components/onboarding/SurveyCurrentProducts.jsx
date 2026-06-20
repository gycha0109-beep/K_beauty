"use client";

import CurrentProductsSelector from "@/components/current-products/CurrentProductsSelector";

export default function SurveyCurrentProducts({
  locale = "ko",
  value = [],
  onChange
}) {
  return (
    <CurrentProductsSelector
      locale={locale}
      value={value}
      onChange={onChange}
    />
  );
}
