"use client";

import { useState } from "react";
import { getProductImageDescriptor } from "@/lib/security/image-source-policy";

export default function SafeProductImage({
  product,
  alt,
  className = "",
  fallback = null,
  loading = "lazy"
}) {
  const descriptor = getProductImageDescriptor(product);
  const [failedSrc, setFailedSrc] = useState(null);

  if (descriptor.kind !== "approved" || descriptor.src === failedSrc) {
    return (
      <div data-product-image-state="placeholder" className="h-full w-full">
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={descriptor.src}
      alt={alt || product?.name || "Product"}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      data-product-image-state="approved"
      onError={() => setFailedSrc(descriptor.src)}
    />
  );
}
