import { Tabs, useRouter } from "expo-router";
import { Pressable, Text, View, type ColorValue } from "react-native";
import { StatusBar } from "expo-status-bar";
import { MOBILE_COPY } from "../lib/copy";
import { MobileShellProvider, useMobileShell } from "../lib/mobile-shell";

type TabIconProps = Readonly<{
  color: ColorValue;
  size: number;
}>;

function HomeTabIcon({ color, size }: TabIconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "flex-end" }}>
      <View
        style={{
          position: "absolute",
          top: size * 0.16,
          width: size * 0.48,
          height: size * 0.48,
          borderRadius: 3,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
      <View
        style={{
          width: size * 0.62,
          height: size * 0.46,
          marginBottom: size * 0.08,
          borderRadius: 4,
          backgroundColor: color
        }}
      />
    </View>
  );
}

function AnalyzeTabIcon({ color, size }: TabIconProps) {
  const ringSize = size * 0.72;
  const stroke = Math.max(2, size * 0.08);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: ringSize,
          height: ringSize,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: stroke,
          borderRadius: ringSize / 2,
          borderColor: color
        }}
      >
        <View
          style={{
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: size * 0.09,
            backgroundColor: color
          }}
        />
      </View>
    </View>
  );
}

function MyTabIcon({ color, size }: TabIconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: size * 0.3,
          height: size * 0.3,
          marginBottom: size * 0.08,
          borderRadius: size * 0.15,
          backgroundColor: color
        }}
      />
      <View
        style={{
          width: size * 0.68,
          height: size * 0.32,
          borderTopLeftRadius: size * 0.34,
          borderTopRightRadius: size * 0.34,
          borderBottomLeftRadius: size * 0.12,
          borderBottomRightRadius: size * 0.12,
          backgroundColor: color
        }}
      />
    </View>
  );
}

function NativeTabs() {
  const router = useRouter();
  const { locale, palette, themeMode } = useMobileShell();
  const copy = MOBILE_COPY[locale];
  const savedReportTitle = locale === "ko" ? "저장 리포트" : "Saved report";
  const privacyTitle = locale === "ko" ? "개인정보" : "Privacy";
  const privacyAccountTitle = locale === "ko" ? "개인정보 · 계정" : "Privacy · Account";
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
        <Tabs.Screen
          name="index"
          options={{
            title: copy.tabs.home,
            tabBarIcon: ({ color, size }) => <HomeTabIcon color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="analyze"
          options={{
            title: copy.tabs.analyze,
            tabBarIcon: ({ color, size }) => <AnalyzeTabIcon color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="my"
          options={{
            title: copy.tabs.my,
            tabBarIcon: ({ color, size }) => <MyTabIcon color={color} size={size} />,
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
                <Pressable
                  testID="mobile-my-privacy-account"
                  accessibilityRole="button"
                  accessibilityLabel={privacyAccountTitle}
                  onPress={() => router.push("/privacy-account")}
                  style={({ pressed }) => ({
                    paddingHorizontal: 7,
                    paddingVertical: 6,
                    opacity: pressed ? 0.6 : 1
                  })}
                >
                  <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "700" }}>
                    {privacyTitle}
                  </Text>
                </Pressable>
                <Pressable
                  testID="mobile-my-latest-report"
                  accessibilityRole="button"
                  accessibilityLabel={savedReportTitle}
                  onPress={() => router.push("/saved-report")}
                  style={({ pressed }) => ({
                    paddingHorizontal: 7,
                    paddingVertical: 6,
                    opacity: pressed ? 0.6 : 1
                  })}
                >
                  <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "700" }}>
                    {savedReportTitle}
                  </Text>
                </Pressable>
              </View>
            )
          }}
        />
        <Tabs.Screen name="privacy-account" options={{ href: null, title: privacyAccountTitle }} />
        <Tabs.Screen name="saved-report" options={{ href: null, title: savedReportTitle }} />
        <Tabs.Screen name="r/[shareId]" options={{ href: null, title: publicResultTitle }} />
        <Tabs.Screen name="premium" options={{ href: null, title: premiumTitle }} />
        <Tabs.Screen name="auth/callback" options={{ href: null, title: "Auth" }} />
        <Tabs.Screen name="store-capture" options={{ href: null, headerShown: false }} />
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
