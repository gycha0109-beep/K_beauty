import { Redirect, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeAnalyzeResultView } from "../features/analyze/NativeAnalyzeResult";
import type { NativeAnalyzeResult } from "../features/analyze/analyze-client";
import { NativeMyDiaryView } from "../features/my/NativeMyDiaryView";
import {
  STORE_DIARY_DASHBOARD_FIXTURE,
  STORE_RESULTS_FIXTURE
} from "../features/store-capture/store-capture-fixtures";
import { useMobileShell } from "../lib/mobile-shell";

type StoreScenario = "results-en" | "diary-en" | "results-ko" | "diary-ko";

function isScenario(value: unknown): value is StoreScenario {
  return value === "results-en" || value === "diary-en" || value === "results-ko" || value === "diary-ko";
}

function localizedResult(locale: "en" | "ko"): NativeAnalyzeResult {
  if (locale === "en") return STORE_RESULTS_FIXTURE;
  return {
    ...STORE_RESULTS_FIXTURE,
    summary: "요약 · 복합성 피부와 보통 수준의 민감도를 고려해 수분·장벽 부담을 낮춘 단순한 루틴이 잘 맞습니다.",
    topPick: STORE_RESULTS_FIXTURE.topPick ? {
      ...STORE_RESULTS_FIXTURE.topPick,
      reason: "현재 카탈로그의 약산성 클렌저로, 매일 부담을 낮춘 세안 방향에 맞는 선택입니다."
    } : null,
    alternative: STORE_RESULTS_FIXTURE.alternative ? {
      ...STORE_RESULTS_FIXTURE.alternative,
      reason: "루틴 부담을 늘리지 않으면서 비교할 수 있는 현재 카탈로그의 또 다른 약산성 선택지입니다.",
      comparison_reason: "세안 후 당김과 선호하는 사용감을 기준으로 비교해 보세요."
    } : null,
    amFocus: "순한 세안 뒤 수분 보충과 자외선 차단을 우선합니다.",
    pmFocus: "과세안 없이 하루의 잔여물을 정리하고 루틴을 단순하게 유지합니다.",
    morning: ["순한 세안", "수분 보습", "자외선 차단"],
    night: ["순한 세안", "장벽 보습"],
    meta: {
      ...STORE_RESULTS_FIXTURE.meta,
      locale: "ko",
      notice: "피부 프로필과 선호를 바탕으로 정리한 결과입니다."
    }
  };
}

export default function StoreCaptureScreen() {
  const params = useLocalSearchParams<{ scenario?: string }>();
  const { palette } = useMobileShell();
  const scenario = params.scenario;
  const enabled = __DEV__ === true && process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === "1";

  if (!enabled || !isScenario(scenario)) {
    return <Redirect href="/" />;
  }

  const locale = scenario.endsWith("-ko") ? "ko" : "en";
  const isResults = scenario.startsWith("results-");

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          {isResults ? (
            <NativeAnalyzeResultView
              locale={locale}
              result={localizedResult(locale)}
              palette={palette}
              onStartOver={() => undefined}
              onOpenPremium={() => undefined}
            />
          ) : (
            <NativeMyDiaryView
              locale={locale}
              dashboard={STORE_DIARY_DASHBOARD_FIXTURE}
              palette={palette}
              showSignedInState
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  column: { width: "100%", maxWidth: 720, alignSelf: "center" }
});
