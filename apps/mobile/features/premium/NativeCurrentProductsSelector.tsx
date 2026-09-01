import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useMobileShell } from "../../lib/mobile-shell";
import {
  loadNativeCurrentProductOptions,
  NATIVE_CURRENT_PRODUCT_GROUPS,
  type NativeCurrentProductGroup,
  type NativeCurrentProductOption,
  type NativeCurrentProductOptionGroups,
  type NativeCurrentProductSelection,
  type NativeCurrentProductStatus
} from "./premium-client";

const COPY = {
  en: {
    kicker: "CURRENT PRODUCTS",
    title: "Current products",
    body: "Optional. Add the products you use now so your Premium report can account for your current routine.",
    loading: "Loading product options…",
    loadError: "Product options could not be loaded. You can still continue without selecting products.",
    selected: "Choose product",
    notInDb: "Using another product",
    notUsing: "Not using",
    noProducts: "No products are available for this group.",
    tapAgain: "Tap the selected status again to clear it."
  },
  ko: {
    kicker: "현재 제품",
    title: "현재 쓰는 제품",
    body: "선택 사항입니다. 현재 사용하는 제품을 추가하면 프리미엄 리포트가 기존 루틴을 함께 고려합니다.",
    loading: "제품 목록을 불러오는 중…",
    loadError: "제품 목록을 불러오지 못했습니다. 제품을 선택하지 않고 계속할 수 있습니다.",
    selected: "제품 선택",
    notInDb: "다른 제품 사용 중",
    notUsing: "사용 안 함",
    noProducts: "이 그룹에서 선택할 수 있는 제품이 없습니다.",
    tapAgain: "선택한 상태를 다시 누르면 해제됩니다."
  }
} as const;

function getGroupLabel(group: NativeCurrentProductGroup, locale: "ko" | "en") {
  const labels = locale === "ko"
    ? {
        cleanser: "클렌저",
        toner_essence: "토너/패드/에센스",
        serum_treatment: "세럼/기능성",
        moisturizer: "크림/보습제",
        sunscreen: "선크림"
      }
    : {
        cleanser: "Cleanser",
        toner_essence: "Toner / pad / essence",
        serum_treatment: "Serum / treatment",
        moisturizer: "Moisturizer",
        sunscreen: "Sunscreen"
      };
  return labels[group.groupId];
}

function toSelectionList(selectionMap: Record<string, NativeCurrentProductSelection>) {
  return Object.values(selectionMap).filter((selection) => {
    if (selection.status === "selected") return Boolean(selection.productId);
    return selection.status === "not_in_db" || selection.status === "not_using";
  });
}

function findGroupForSelection(selection: NativeCurrentProductSelection) {
  return NATIVE_CURRENT_PRODUCT_GROUPS.find((group) => {
    const categories = group.categories as readonly string[];
    return categories.includes(selection.category) || group.categoryIntent === selection.category;
  });
}

export function NativeCurrentProductsSelector({
  value,
  onChange
}: {
  value: NativeCurrentProductSelection[];
  onChange: (value: NativeCurrentProductSelection[]) => void;
}) {
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [options, setOptions] = useState<NativeCurrentProductOptionGroups | null>(null);
  const [selectionMap, setSelectionMap] = useState<Record<string, NativeCurrentProductSelection>>(() => {
    const initial: Record<string, NativeCurrentProductSelection> = {};
    for (const selection of value) {
      const group = findGroupForSelection(selection);
      if (group) initial[group.groupId] = selection;
    }
    return initial;
  });

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    loadNativeCurrentProductOptions()
      .then((next) => {
        if (!active) return;
        setOptions(next);
        setLoadState("ready");
      })
      .catch(() => {
        if (!active) return;
        setOptions(null);
        setLoadState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onChange(toSelectionList(selectionMap));
  }, [onChange, selectionMap]);

  const statusOptions = useMemo(
    () => [
      { status: "selected" as const, label: copy.selected },
      { status: "not_in_db" as const, label: copy.notInDb },
      { status: "not_using" as const, label: copy.notUsing }
    ],
    [copy.notInDb, copy.notUsing, copy.selected]
  );

  const setGroupStatus = (group: NativeCurrentProductGroup, status: NativeCurrentProductStatus) => {
    setSelectionMap((current) => {
      if (current[group.groupId]?.status === status) {
        const next = { ...current };
        delete next[group.groupId];
        return next;
      }

      if (status === "selected") {
        const previousProductId =
          current[group.groupId]?.status === "selected"
            ? current[group.groupId]?.productId
            : undefined;
        return {
          ...current,
          [group.groupId]: {
            category: group.categoryIntent,
            status,
            ...(previousProductId ? { productId: previousProductId } : {})
          }
        };
      }

      return {
        ...current,
        [group.groupId]: {
          category: group.categoryIntent,
          status
        }
      };
    });
  };

  const setGroupProduct = (
    group: NativeCurrentProductGroup,
    product: NativeCurrentProductOption
  ) => {
    const acceptedCategories = group.categories as readonly string[];
    setSelectionMap((current) => ({
      ...current,
      [group.groupId]: {
        category: acceptedCategories.includes(product.category)
          ? product.category
          : group.categoryIntent,
        status: "selected",
        productId: product.id
      }
    }));
  };

  return (
    <View
      testID="native-premium-current-products"
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>{copy.kicker}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: palette.textMuted }]}>{copy.body}</Text>
      </View>

      {loadState === "loading" ? (
        <Text style={[styles.helper, { color: palette.textMuted }]}>{copy.loading}</Text>
      ) : null}
      {loadState === "error" ? (
        <Text testID="native-premium-current-products-error" style={[styles.helper, { color: palette.textMuted }]}>
          {copy.loadError}
        </Text>
      ) : null}

      {NATIVE_CURRENT_PRODUCT_GROUPS.map((group) => {
        const selection = selectionMap[group.groupId] || null;
        const groupOptions = options?.[group.groupId] || [];

        return (
          <View key={group.groupId} style={[styles.group, { borderColor: palette.border }]}>
            <Text style={[styles.groupTitle, { color: palette.text }]}>
              {getGroupLabel(group, locale)}
            </Text>

            <View style={styles.statusRow}>
              {statusOptions.map((option) => {
                const active = selection?.status === option.status;
                return (
                  <Pressable
                    key={option.status}
                    testID={`native-premium-product-status-${group.groupId}-${option.status}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setGroupStatus(group, option.status)}
                    style={({ pressed }) => [
                      styles.statusButton,
                      {
                        borderColor: active ? palette.accent : palette.border,
                        backgroundColor: active ? palette.accent : palette.surfaceMuted,
                        opacity: pressed ? 0.72 : 1
                      }
                    ]}
                  >
                    <Text style={[styles.statusText, { color: active ? palette.background : palette.text }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selection?.status === "selected" ? (
              groupOptions.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.productRow}
                >
                  {groupOptions.map((product) => {
                    const active = selection.productId === product.id;
                    return (
                      <Pressable
                        key={product.id}
                        testID={`native-premium-product-${group.groupId}-${product.id}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setGroupProduct(group, product)}
                        style={({ pressed }) => [
                          styles.productButton,
                          {
                            borderColor: active ? palette.accent : palette.border,
                            backgroundColor: active ? palette.surfaceMuted : palette.surface,
                            opacity: pressed ? 0.72 : 1
                          }
                        ]}
                      >
                        <Text style={[styles.productName, { color: palette.text }]}>
                          {[product.brand, product.name].filter(Boolean).join(" · ")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : loadState === "ready" ? (
                <Text style={[styles.helper, { color: palette.textMuted }]}>{copy.noProducts}</Text>
              ) : null
            ) : null}
          </View>
        );
      })}

      <Text style={[styles.helper, { color: palette.textMuted }]}>{copy.tapAgain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14
  },
  header: {
    gap: 6
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800"
  },
  body: {
    fontSize: 13,
    lineHeight: 20
  },
  helper: {
    fontSize: 12,
    lineHeight: 18
  },
  group: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10
  },
  groupTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800"
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statusButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700"
  },
  productRow: {
    gap: 8,
    paddingRight: 8
  },
  productButton: {
    maxWidth: 230,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  productName: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700"
  }
});
