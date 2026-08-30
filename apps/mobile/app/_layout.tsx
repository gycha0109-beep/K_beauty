import { Tabs, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { MOBILE_COPY } from "../lib/copy";
import { MobileShellProvider, useMobileShell } from "../lib/mobile-shell";

function NativeTabs() {
  const router = useRouter();
  const { locale, palette, themeMode } = useMobileShell();
  const copy = MOBILE_COPY[locale];
  const savedReportTitle = locale === "ko" ? "저장 리포트" : "Saved report";
  const publicResultTitle = locale === "ko" ? "공유 결과" : "Shared result";
  const premiumTitle = locale === "ko" ? "프리미엄 리포트" : "Premium report";

  return (
    <>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      <Tabs
        screenOptions={{
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: palette.background },
          tabBarActiveTintColor: palette.accent,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarStyle: {
            backgroundColor: palette.tabBar,
            borderTopColor: palette.border
          },
          tabBarHideOnKeyboard: true
        }}
      >
        <Tabs.Screen name="index" options={{ title: copy.tabs.home }} />
        <Tabs.Screen name="analyze" options={{ title: copy.tabs.analyze }} />
        <Tabs.Screen
          name="my"
          options={{
            title: copy.tabs.my,
            headerRight: () => (
              <Pressable
                testID="mobile-my-latest-report"
                accessibilityRole="button"
                accessibilityLabel={savedReportTitle}
                onPress={() => router.push("/saved-report")}
                style={({ pressed }) => ({
                  marginRight: 14,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  opacity: pressed ? 0.6 : 1
                })}
              >
                <Text style={{ color: palette.accent, fontSize: 13, fontWeight: "700" }}>
                  {savedReportTitle}
                </Text>
              </Pressable>
            )
          }}
        />
        <Tabs.Screen name="saved-report" options={{ href: null, title: savedReportTitle }} />
        <Tabs.Screen name="r/[shareId]" options={{ href: null, title: publicResultTitle }} />
        <Tabs.Screen name="premium" options={{ href: null, title: premiumTitle }} />
        <Tabs.Screen name="auth/callback" options={{ href: null, title: "Auth" }} />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <MobileShellProvider>
      <NativeTabs />
    </MobileShellProvider>
  );
}
