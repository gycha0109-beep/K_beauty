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

const LIGHT_PALETTE: MobilePalette = {
  background: "#FCFAFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F0FF",
  text: "#201A2E",
  textMuted: "#5A5363",
  accent: "#7258A8",
  border: "#E3DDEF",
  tabBar: "#FFFFFF"
};

const DARK_PALETTE: MobilePalette = {
  background: "#15121B",
  surface: "#211C29",
  surfaceMuted: "#2B2437",
  text: "#F7F2FF",
  textMuted: "#C8BED3",
  accent: "#C1A7FF",
  border: "#3B3347",
  tabBar: "#1C1823"
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
