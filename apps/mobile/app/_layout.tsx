import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MOBILE_COPY } from "../lib/copy";
import { MobileShellProvider, useMobileShell } from "../lib/mobile-shell";

function NativeTabs() {
  const { locale, palette, themeMode } = useMobileShell();
  const copy = MOBILE_COPY[locale];

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
        <Tabs.Screen name="my" options={{ title: copy.tabs.my }} />
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
