import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          headerTitleAlign: "center",
          tabBarHideOnKeyboard: true
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="analyze" options={{ title: "Analyze" }} />
        <Tabs.Screen name="my" options={{ title: "My" }} />
      </Tabs>
    </>
  );
}
