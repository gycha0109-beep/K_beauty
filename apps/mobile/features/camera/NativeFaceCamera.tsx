import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";

export type NativeFaceCameraCopy = {
  permissionLoading: string;
  permissionTitle: string;
  permissionDescription: string;
  grantPermission: string;
  openSettings: string;
  previewLabel: string;
  ready: string;
  preparing: string;
  capture: string;
  capturing: string;
  captureFailed: string;
  capturedLabel: string;
  retake: string;
  localOnly: string;
};

type NativeFaceCameraProps = {
  copy: NativeFaceCameraCopy;
  palette: {
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    accent: string;
    border: string;
  };
};

export function NativeFaceCamera({ copy, palette }: NativeFaceCameraProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isFocused, setIsFocused] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setIsCameraReady(false);
      };
    }, [])
  );

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setCameraError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        exif: false
      });

      setCapturedPhoto(photo);
      setIsCameraReady(false);
    } catch {
      setCameraError(copy.captureFailed);
    } finally {
      setIsCapturing(false);
    }
  }, [copy.captureFailed, isCameraReady, isCapturing]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    setCameraError(null);
    setIsCameraReady(false);
  }, []);

  if (!permission) {
    return (
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.statusText, { color: palette.textMuted }]}>{copy.permissionLoading}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain !== false;

    return (
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.panelTitle, { color: palette.text }]}>{copy.permissionTitle}</Text>
        <Text style={[styles.bodyText, { color: palette.textMuted }]}>{copy.permissionDescription}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={canAskAgain ? requestPermission : Linking.openSettings}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: palette.accent, opacity: pressed ? 0.82 : 1 }
          ]}
        >
          <Text style={styles.primaryButtonText}>{canAskAgain ? copy.grantPermission : copy.openSettings}</Text>
        </Pressable>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.stack}>
        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>{copy.capturedLabel}</Text>
        <View style={[styles.cameraFrame, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Image source={{ uri: capturedPhoto.uri }} style={styles.camera} resizeMode="cover" />
        </View>
        <Text style={[styles.localOnly, { color: palette.textMuted }]}>{copy.localOnly}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retakePhoto}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: palette.border, backgroundColor: palette.surface, opacity: pressed ? 0.82 : 1 }
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>{copy.retake}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>{copy.previewLabel}</Text>
      <View style={[styles.cameraFrame, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        {isFocused ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            mode="picture"
            onCameraReady={() => {
              setIsCameraReady(true);
              setCameraError(null);
            }}
            onMountError={() => {
              setIsCameraReady(false);
              setCameraError(copy.captureFailed);
            }}
          />
        ) : null}
      </View>
      <Text style={[styles.statusText, { color: cameraError ? "#B42318" : palette.textMuted }]}>
        {cameraError ?? (isCameraReady ? copy.ready : copy.preparing)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !isCameraReady || isCapturing }}
        disabled={!isCameraReady || isCapturing}
        onPress={capturePhoto}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: palette.accent,
            opacity: !isCameraReady || isCapturing ? 0.45 : pressed ? 0.82 : 1
          }
        ]}
      >
        <Text style={styles.primaryButtonText}>{isCapturing ? copy.capturing : copy.capture}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  panel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 12
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "700"
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  cameraFrame: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden"
  },
  camera: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20
  },
  localOnly: {
    fontSize: 13,
    lineHeight: 19
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700"
  }
});
