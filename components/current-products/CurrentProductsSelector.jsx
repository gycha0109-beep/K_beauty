"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCurrentProductCategoryLabel,
  normalizeCurrentProductCategory
} from "@/lib/current-products";

const GROUPS = [
  { groupId: "cleanser", categoryIntent: "cleanser", categories: ["cleanser"] },
  { groupId: "toner_essence", categoryIntent: "toner_essence", categories: ["toner_essence", "toner_pad", "essence"] },
  { groupId: "serum_treatment", categoryIntent: "treatment", categories: ["serum", "ampoule", "treatment"] },
  { groupId: "moisturizer", categoryIntent: "moisturizer", categories: ["moisturizer"] },
  { groupId: "sunscreen", categoryIntent: "sunscreen", categories: ["sunscreen"] }
];

const COPY = {
  ko: {
    kicker: "CURRENT PRODUCTS",
    title: "현재 쓰는 제품",
    body: "유료 리포트에서 현재 루틴을 참고할 수 있도록 선택값만 전달합니다.",
    selected: "DB 제품 선택",
    notInDb: "사용 중 / DB 미등록",
    notUsing: "사용 안 함",
    choose: "제품 선택",
    noProducts: "선택 가능한 제품이 아직 없습니다.",
    loading: "제품 목록 불러오는 중",
    error: "제품 목록을 불러오지 못했습니다.",
    optional: "선택 사항"
  },
  en: {
    kicker: "CURRENT PRODUCTS",
    title: "Current products",
    body: "These choices are sent only as context for the paid report.",
    selected: "DB product",
    notInDb: "Using / not in DB",
    notUsing: "Not using",
    choose: "Choose product",
    noProducts: "No products available yet.",
    loading: "Loading products",
    error: "Could not load products.",
    optional: "Optional"
  }
};

function getGroupLabel(group, locale) {
  if (group.groupId === "toner_essence") {
    return locale === "en" ? "Toner / pad / essence" : "토너/패드/에센스";
  }

  if (group.groupId === "serum_treatment") {
    return locale === "en" ? "Serum / treatment" : "세럼/기능성";
  }

  return getCurrentProductCategoryLabel(group.categoryIntent, locale);
}

function getStatusOptions(copy) {
  return [
    { status: "selected", label: copy.selected },
    { status: "not_in_db", label: copy.notInDb },
    { status: "not_using", label: copy.notUsing }
  ];
}

function normalizeOptionGroup(product) {
  return normalizeCurrentProductCategory(product?.category);
}

function dedupeProducts(products = []) {
  const seen = new Set();
  const deduped = [];

  for (const product of products) {
    const id = String(product?.id || "").trim();

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    deduped.push(product);
  }

  return deduped;
}

async function fetchCurrentProductOptionsByCategory(category) {
  const normalizedCategory = normalizeCurrentProductCategory(category);

  if (!normalizedCategory) {
    return [];
  }

  const response = await fetch(`/api/current-products/products?category=${encodeURIComponent(normalizedCategory)}`);
  const data = await response.json().catch(() => null);

  if (response.status === 400) {
    return [];
  }

  if (!response.ok || !data?.success || !Array.isArray(data.products)) {
    throw new Error("load_failed");
  }

  return data.products;
}

async function fetchCurrentProductOptionsByGroup(group) {
  const productsByCategory = await Promise.all(
    group.categories.map((category) => fetchCurrentProductOptionsByCategory(category))
  );

  return dedupeProducts(productsByCategory.flat());
}

function toSelectionList(selectionMap) {
  return Object.values(selectionMap)
    .filter(Boolean)
    .filter((selection) => {
      if (selection.status === "selected") {
        return Boolean(selection.productId);
      }

      return selection.status === "not_in_db" || selection.status === "not_using";
    });
}

export default function CurrentProductsSelector({
  locale = "ko",
  value = [],
  onChange
}) {
  const copy = COPY[locale] || COPY.ko;
  const [products, setProducts] = useState([]);
  const [loadState, setLoadState] = useState("idle");
  const [selectionMap, setSelectionMap] = useState(() => {
    const next = {};

    value.forEach((item) => {
      const category = normalizeCurrentProductCategory(item?.category);
      const group = GROUPS.find((candidate) => candidate.categories.includes(category));

      if (group && item?.status) {
        next[group.groupId] = item;
      }
    });

    return next;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoadState("loading");

      try {
        const productsByGroup = await Promise.all(GROUPS.map(fetchCurrentProductOptionsByGroup));
        const nextProducts = dedupeProducts(productsByGroup.flat());

        if (!cancelled) {
          setProducts(nextProducts);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setLoadState("error");
        }
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onChange?.(toSelectionList(selectionMap));
  }, [onChange, selectionMap]);

  const productsByGroup = useMemo(() => {
    return GROUPS.reduce((acc, group) => {
      acc[group.groupId] = products.filter((product) => {
        const normalized = normalizeOptionGroup(product);
        return group.categories.includes(normalized);
      });
      return acc;
    }, {});
  }, [products]);

  const setGroupStatus = (group, status) => {
    setSelectionMap((current) => {
      const next = { ...current };

      if (status === "selected") {
        const existingProductId = current[group.groupId]?.productId || "";
        const existingCategory = existingProductId
          ? normalizeCurrentProductCategory(current[group.groupId]?.category)
          : "";
        next[group.groupId] = {
          category: existingCategory || group.categoryIntent,
          status: "selected",
          productId: existingProductId
        };
      } else {
        next[group.groupId] = {
          category: group.categoryIntent,
          status
        };
      }

      return next;
    });
  };

  const setGroupProduct = (group, productId) => {
    const product = products.find((item) => item.id === productId);
    const category = normalizeCurrentProductCategory(product?.category) || group.categoryIntent;

    setSelectionMap((current) => ({
      ...current,
      [group.groupId]: {
        category,
        status: "selected",
        productId
      }
    }));
  };

  return (
    <section className="ui-card mt-3 space-y-3 p-3 sm:p-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="ui-kicker">{copy.kicker}</p>
          <span className="ui-chip-compact">{copy.optional}</span>
        </div>
        <h3 className="ui-title mt-1 text-lg leading-tight">{copy.title}</h3>
        <p className="ui-text-secondary mt-1 text-xs leading-5">{copy.body}</p>
      </div>

      {loadState === "loading" ? (
        <p className="ui-text-faint text-xs">{copy.loading}</p>
      ) : null}
      {loadState === "error" ? (
        <p className="ui-text-danger text-xs font-medium">{copy.error}</p>
      ) : null}

      <div className="grid gap-3">
        {GROUPS.map((group) => {
          const groupProducts = productsByGroup[group.groupId] || [];
          const selection = selectionMap[group.groupId] || null;
          const status = selection?.status || "";

          return (
            <div key={group.groupId} className="rounded-[1rem] border border-[#ead2ca]/70 bg-white/32 p-3 dark:border-white/[0.08] dark:bg-white/[0.035]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#321724] dark:text-[#fff8f3]">
                  {getGroupLabel(group, locale)}
                </p>
                {status ? (
                  <span className="rounded-full border border-[#ead2ca]/70 px-2 py-0.5 text-[10px] font-semibold text-[#8a4a5c] dark:border-white/[0.10] dark:text-[#f0c5cf]">
                    {getStatusOptions(copy).find((item) => item.status === status)?.label}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {getStatusOptions(copy).map((option) => (
                  <button
                    key={option.status}
                    type="button"
                    onClick={() => setGroupStatus(group, option.status)}
                    className={`min-h-10 rounded-[0.85rem] border px-2.5 py-2 text-xs font-semibold transition ${
                      status === option.status
                        ? "border-[#e76b91]/55 bg-[#ffe5eb]/72 text-[#7a253f] dark:border-[#ff9aa8]/38 dark:bg-[#ff9aa8]/12 dark:text-[#ffd7df]"
                        : "border-[#ead2ca]/70 bg-white/42 text-[#7a5360] hover:bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-[#c8aeb8] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {status === "selected" ? (
                <label className="mt-2 block">
                  <span className="sr-only">{copy.choose}</span>
                  <select
                    value={selection?.productId || ""}
                    onChange={(event) => setGroupProduct(group, event.target.value)}
                    className="min-h-11 w-full rounded-[0.85rem] border border-[#ead2ca]/80 bg-white/72 px-3 text-sm font-medium text-[#321724] outline-none transition focus:border-[#e76b91] dark:border-white/[0.10] dark:bg-[#20141c] dark:text-[#fff8f3]"
                  >
                    <option value="">{copy.choose}</option>
                    {groupProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.brand} - {product.name}
                      </option>
                    ))}
                  </select>
                  {!groupProducts.length ? (
                    <span className="mt-1 block text-xs text-[#9b7480] dark:text-[#8f7480]">
                      {copy.noProducts}
                    </span>
                  ) : null}
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
