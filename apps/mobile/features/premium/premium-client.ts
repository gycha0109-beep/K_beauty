import type { Session } from "@supabase/auth-js";

import { getMobileApiBaseUrl } from "../../lib/env";

export type NativePremiumAccess = Readonly<{
  canCreatePremium: boolean;
  reason: string;
  releaseMode: string;
  entitlement: string;
  configurationInvalid: boolean;
}>;

export type NativeCurrentProductStatus = "selected" | "not_in_db" | "not_using";

export type NativeCurrentProductSelection = Readonly<{
  category: string;
  status: NativeCurrentProductStatus;
  productId?: string;
}>;

export type NativeCurrentProductOption = Readonly<{
  id: string;
  brand: string;
  name: string;
  category: string;
  productForm: string;
}>;

export const NATIVE_CURRENT_PRODUCT_GROUPS = [
  {
    groupId: "cleanser",
    categoryIntent: "cleanser",
    categories: ["cleanser"]
  },
  {
    groupId: "toner_essence",
    categoryIntent: "toner_essence",
    categories: ["toner_essence", "toner_pad"]
  },
  {
    groupId: "serum_treatment",
    categoryIntent: "treatment",
    categories: ["treatment"]
  },
  {
    groupId: "moisturizer",
    categoryIntent: "moisturizer",
    categories: [
      "moisturizer",
      "moisturizer_lotion_emulsion",
      "moisturizer_gel",
      "moisturizer_cream",
      "moisturizer_balm"
    ]
  },
  {
    groupId: "sunscreen",
    categoryIntent: "sunscreen",
    categories: ["sunscreen"]
  }
] as const;

export type NativeCurrentProductGroup = (typeof NATIVE_CURRENT_PRODUCT_GROUPS)[number];
export type NativeCurrentProductOptionGroups = Record<
  NativeCurrentProductGroup["groupId"],
  NativeCurrentProductOption[]
>;

export type NativePremiumFinalization = Readonly<{
  savedReportId: string;
  source: "premium-session" | "saved-report";
  report: Record<string, unknown>;
}>;

export class NativePremiumRequestError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly reason: string | null;
  readonly releaseMode: string | null;

  constructor(
    code: string,
    message: string,
    options: {
      status?: number | null;
      reason?: string | null;
      releaseMode?: string | null;
    } = {}
  ) {
    super(message);
    this.name = "NativePremiumRequestError";
    this.code = code;
    this.status = options.status ?? null;
    this.reason = options.reason ?? null;
    this.releaseMode = options.releaseMode ?? null;
  }
}

function bearerHeaders(session: Session) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${session.access_token}`
  };
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

function isPremiumAccess(value: unknown): value is NativePremiumAccess {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.canCreatePremium === "boolean" &&
    typeof payload.reason === "string" &&
    typeof payload.releaseMode === "string" &&
    typeof payload.entitlement === "string" &&
    typeof payload.configurationInvalid === "boolean"
  );
}

function toProductOption(value: unknown): NativeCurrentProductOption | null {
  if (!value || typeof value !== "object") return null;
  const product = value as Record<string, unknown>;
  const id = typeof product.id === "string" ? product.id.trim() : "";
  const name = typeof product.name === "string" ? product.name.trim() : "";
  const category = typeof product.category === "string" ? product.category.trim() : "";
  if (!id || !name || !category) return null;

  return {
    id,
    brand: typeof product.brand === "string" ? product.brand.trim() : "",
    name,
    category,
    productForm:
      typeof product.product_form === "string"
        ? product.product_form.trim()
        : typeof product.productForm === "string"
          ? product.productForm.trim()
          : ""
  };
}

function getRequestError(
  response: Response,
  payload: any,
  fallbackCode: string,
  fallbackMessage: string
) {
  const code =
    typeof payload?.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : fallbackCode;
  const reason =
    typeof payload?.reason === "string" && payload.reason.trim()
      ? payload.reason.trim()
      : null;
  const releaseMode =
    typeof payload?.releaseMode === "string" && payload.releaseMode.trim()
      ? payload.releaseMode.trim()
      : null;

  return new NativePremiumRequestError(
    code,
    typeof payload?.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : fallbackMessage,
    {
      status: response.status,
      reason,
      releaseMode
    }
  );
}

export async function loadNativePremiumAccess(
  session: Session
): Promise<NativePremiumAccess> {
  let response: Response;

  try {
    response = await fetch(`${getMobileApiBaseUrl()}/api/premium/access`, {
      method: "GET",
      headers: bearerHeaders(session),
      credentials: "include"
    });
  } catch {
    throw new NativePremiumRequestError(
      "mobile_premium_access_network_failed",
      "Could not reach the Premium access endpoint."
    );
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw getRequestError(
      response,
      payload,
      "mobile_premium_access_failed",
      "Premium access could not be checked."
    );
  }

  if (!isPremiumAccess(payload)) {
    throw new NativePremiumRequestError(
      "mobile_premium_access_shape_invalid",
      "Premium access response is invalid.",
      { status: response.status }
    );
  }

  return payload;
}

async function loadCurrentProductCategory(
  category: string
): Promise<NativeCurrentProductOption[]> {
  const response = await fetch(
    `${getMobileApiBaseUrl()}/api/current-products/products?category=${encodeURIComponent(category)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include"
    }
  );
  const payload = await readJson(response);

  if (!response.ok || payload?.success !== true || !Array.isArray(payload?.products)) {
    throw getRequestError(
      response,
      payload,
      "mobile_current_products_load_failed",
      "Current products could not be loaded."
    );
  }

  return payload.products
    .map(toProductOption)
    .filter((product: NativeCurrentProductOption | null): product is NativeCurrentProductOption =>
      Boolean(product)
    );
}

function dedupeProducts(products: NativeCurrentProductOption[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

export async function loadNativeCurrentProductOptions(): Promise<NativeCurrentProductOptionGroups> {
  const entries = await Promise.all(
    NATIVE_CURRENT_PRODUCT_GROUPS.map(async (group) => {
      const products = (
        await Promise.all(group.categories.map((category) => loadCurrentProductCategory(category)))
      ).flat();
      return [group.groupId, dedupeProducts(products)] as const;
    })
  );

  return Object.fromEntries(entries) as NativeCurrentProductOptionGroups;
}

export async function createNativePremiumReport(input: {
  session: Session;
  locale: "ko" | "en";
  currentProducts: NativeCurrentProductSelection[];
}): Promise<NativePremiumFinalization> {
  let response: Response;

  try {
    response = await fetch(`${getMobileApiBaseUrl()}/api/full-report`, {
      method: "POST",
      headers: {
        ...bearerHeaders(input.session),
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        locale: input.locale,
        currentProducts: input.currentProducts
      })
    });
  } catch {
    throw new NativePremiumRequestError(
      "mobile_premium_finalize_network_failed",
      "Could not reach the Premium report endpoint."
    );
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw getRequestError(
      response,
      payload,
      "mobile_premium_finalize_failed",
      "Premium report could not be finalized."
    );
  }

  const source = payload?.meta?.source;
  const savedReportId = payload?.meta?.persistence?.savedReportId;

  if (
    (source !== "premium-session" && source !== "saved-report") ||
    typeof savedReportId !== "string" ||
    !savedReportId.trim()
  ) {
    throw new NativePremiumRequestError(
      "mobile_premium_finalize_shape_invalid",
      "Premium report response is invalid.",
      { status: response.status }
    );
  }

  return {
    savedReportId: savedReportId.trim(),
    source,
    report: payload as Record<string, unknown>
  };
}
