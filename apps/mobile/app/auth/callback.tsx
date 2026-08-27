import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { completeNativeAuthFromUrl } from "../../lib/auth";
import { useMobileShell } from "../../lib/mobile-shell";

export default function NativeAuthCallbackScreen() {
  const authUrl = Linking.useLinkingURL();
  const { palette } = useMobileShell();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    if (!authUrl) {
      return;
    }

    let active = true;

    completeNativeAuthFromUrl(authUrl)
      .then(() => {
        if (active) {
          setMessage("Sign-in complete");
          router.replace("/my");
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Sign-in could not be completed. Return to My and try again.");
        }
      });

    return () => {
      active = false;
    };
  }, [authUrl]);

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>BEJEWELY</Text>
      <Text style={[styles.message, { color: palette.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 24,
    fontWeight: "700"
  },
  message: {
    marginTop: 12,
    maxWidth: 320,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22
  }
});
