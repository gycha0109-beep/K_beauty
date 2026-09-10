import type { SupportedLocale } from "@bejewely/shared";
import { getLocales } from "expo-localization";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

type ThemeMode = "light" | "dark";

type MobilePalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
  tabBar: string;
};

type MobileShellValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  themeMode: ThemeMode;
  palette: MobilePalette;
};

// Keep the native shell on the same visual language as the current web app.
// These values mirror app/globals.css rather than introducing a mobile-only palette.
const LIGHT_PALETTE: MobilePalette = {
  background: "#FFF8FA",
  surface: "#FFFFFF",
  surfaceMuted: "#FFF3EE",
  text: "#111111",
  textMuted: "#666666",
  accent: "#FF4F8A",
  border: "#F0E6EA",
  tabBar: "#FFFFFF"
};

const DARK_PALETTE: MobilePalette = {
  background: "#0B0A0E",
  surface: "#17141C",
  surfaceMuted: "#2B1C26",
  text: "#FFFFFF",
  textMuted: "#A1A1AA",
  accent: "#FF4F8A",
  border: "#2D2932",
  tabBar: "#17141C"
};

const MobileShellContext = createContext<MobileShellValue | null>(null);

function resolveInitialLocale(): SupportedLocale {
  try {
    return getLocales()[0]?.languageCode === "ko" ? "ko" : "en";
  } catch {
    return "en";
  }
}

export function MobileShellProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [locale, setLocale] = useState<SupportedLocale>(resolveInitialLocale);
  const themeMode: ThemeMode = systemScheme === "dark" ? "dark" : "light";
  const palette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const value = useMemo<MobileShellValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale((current) => (current === "ko" ? "en" : "ko")),
      themeMode,
      palette
    }),
    [locale, palette, themeMode]
  );

  return <MobileShellContext.Provider value={value}>{children}</MobileShellContext.Provider>;
}

export function useMobileShell() {
  const value = useContext(MobileShellContext);

  if (!value) {
    throw new Error("useMobileShell must be used inside MobileShellProvider");
  }

  return value;
}
