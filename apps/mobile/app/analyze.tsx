import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { NativeFaceCamera, type NativeCameraPhoto } from "../features/camera/NativeFaceCamera";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

export default function AnalyzeScreen() {
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].analyze;
  const [, setCapturedPhoto] = useState<NativeCameraPhoto | null>(null);

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <Text style={[styles.notice, { color: palette.textMuted }]}>{copy.notice}</Text>
      <NativeFaceCamera
        copy={{ ...copy.camera, previewLabel: copy.title }}
        palette={palette}
        onPhotoChange={setCapturedPhoto}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4
  }
});
