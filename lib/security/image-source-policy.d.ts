export type ProductImageDescriptor =
  | { readonly kind: "approved"; readonly src: string }
  | { readonly kind: "none"; readonly src: null };

export function resolveSafeProductImage(value: unknown): string | null;
export function assertSafeProductImageForWriter(value: unknown): string | null;
export function getProductImageDescriptor(product: unknown): ProductImageDescriptor;
