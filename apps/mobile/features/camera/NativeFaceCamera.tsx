import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  detectNativeFacesAsync,
  isNativeFaceGuideAvailable
} from "../../modules/bejewely-face-guide/src/BejewelyFaceGuideModule";
import {
  evaluateNativeFaceGuidance,
  NATIVE_FACE_GUIDANCE_SAMPLE_INTERVAL_MS,
  NATIVE_FACE_GUIDANCE_STABLE_SAMPLES,
  type NativeFaceGuidanceRect,
  type NativeFaceGuidanceState
} from "./NativeFaceGuidance";

export type NativeCameraPhoto = Readonly<{
  uri: string;
  name: string;
  type: "image/jpeg";
  width: number;
  height: number;
}>;

export type NativeFaceCameraCopy = {
  permissionLoading: string;
  permissionTitle: string;
  permissionDescription: string;
  grantPermission: string;
  openSettings: string;
  openCamera: string;
  closeCamera: string;
  previewLabel: string;
  ready: string;
  preparing: string;
  alignFace: string;
  capture: string;
  capturing: string;
  captureFailed: string;
  capturedLabel: string;
  retake: string;
  localOnly: string;
  guidance: {
    loading: string;
    noFace: string;
    multipleFaces: string;
    tooFar: string;
    tooClose: string;
    offCenter: string;
    notFrontal: string;
    stabilizing: string;
    ready: string;
    unavailable: string;
  };
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
  onPhotoChange?: (photo: NativeCameraPhoto | null) => void;
};

export function buildUploadReadyCameraPhoto(photo: CameraCapturedPicture): NativeCameraPhoto {
  const leaf = photo.uri.split(/[\\/]/).pop() || "bejewely-skin-photo.jpg";
  const stem = leaf.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-") || "bejewely-skin-photo";

  return {
    uri: photo.uri,
    name: `${stem}.jpg`,
    type: "image/jpeg",
    width: photo.width,
    height: photo.height
  };
}

function resolveGuidanceCopy(copy: NativeFaceCameraCopy, state: NativeFaceGuidanceState) {
  switch (state) {
    case "no_face":
      return copy.guidance.noFace;
    case "multiple_faces":
      return copy.guidance.multipleFaces;
    case "too_far":
      return copy.guidance.tooFar;
    case "too_close":
      return copy.guidance.tooClose;
    case "off_center":
      return copy.guidance.offCenter;
    case "not_frontal":
      return copy.guidance.notFrontal;
    case "stabilizing":
      return copy.guidance.stabilizing;
    case "ready":
      return copy.guidance.ready;
    case "unavailable":
      return copy.guidance.unavailable;
    case "loading":
    default:
      return copy.guidance.loading;
  }
}

export function NativeFaceCamera({ copy, palette, onPhotoChange }: NativeFaceCameraProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const guidanceInFlightRef = useRef<Promise<void> | null>(null);
  const guidanceGenerationRef = useRef(0);
  const guidanceReadySamplesRef = useRef(0);
  const finalCaptureLockRef = useRef(false);
  const previewRectRef = useRef<NativeFaceGuidanceRect | null>(null);
  const guideRectRef = useRef<NativeFaceGuidanceRect | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isFocused, setIsFocused] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<NativeCameraPhoto | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [guidanceState, setGuidanceState] = useState<NativeFaceGuidanceState>("loading");

  const resetGuidance = useCallback(() => {
    guidanceGenerationRef.current += 1;
    guidanceReadySamplesRef.current = 0;
    setGuidanceState("loading");
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setIsFullscreenOpen(true);
      resetGuidance();
      return () => {
        guidanceGenerationRef.current += 1;
        guidanceReadySamplesRef.current = 0;
        finalCaptureLockRef.current = false;
        setIsFocused(false);
        setIsFullscreenOpen(false);
        setIsCameraReady(false);
      };
    }, [resetGuidance])
  );

  const closeCamera = useCallback(() => {
    finalCaptureLockRef.current = false;
    setIsFullscreenOpen(false);
    setIsCameraReady(false);
    setCameraError(null);
    resetGuidance();
  }, [resetGuidance]);

  const openCamera = useCallback(() => {
    setIsFullscreenOpen(true);
    setIsCameraReady(false);
    setCameraError(null);
    resetGuidance();
  }, [resetGuidance]);

  useEffect(() => {
    if (
      !permission?.granted ||
      !isFocused ||
      !isFullscreenOpen ||
      capturedPhoto ||
      !isCameraReady ||
      isCapturing
    ) {
      return;
    }

    if (!isNativeFaceGuideAvailable) {
      setGuidanceState("unavailable");
      return;
    }

    let cancelled = false;
    const generation = guidanceGenerationRef.current + 1;
    guidanceGenerationRef.current = generation;

    const sampleGuidance = async () => {
      if (cancelled || finalCaptureLockRef.current || guidanceInFlightRef.current) {
        return;
      }

      const camera = cameraRef.current;
      const previewRect = previewRectRef.current;
      const guideRect = guideRectRef.current;
      if (!camera || !previewRect || !guideRect) {
        setGuidanceState("loading");
        return;
      }

      let currentTask: Promise<void>;
      currentTask = (async () => {
        try {
          const sample = await camera.takePictureAsync({
            quality: 0.2,
            base64: false,
            exif: false,
            skipProcessing: false,
            shutterSound: false
          });
          const detection = await detectNativeFacesAsync(sample.uri, true);

          if (cancelled || generation !== guidanceGenerationRef.current || finalCaptureLockRef.current) {
            return;
          }

          if (!detection) {
            guidanceReadySamplesRef.current = 0;
            setGuidanceState("unavailable");
            return;
          }

          const evaluation = evaluateNativeFaceGuidance({
            faces: detection.faces,
            imageWidth: sample.width,
            imageHeight: sample.height,
            previewRect,
            guideRect,
            mirrored: true
          });

          if (evaluation.state === "ready") {
            guidanceReadySamplesRef.current += 1;
            setGuidanceState(
              guidanceReadySamplesRef.current >= NATIVE_FACE_GUIDANCE_STABLE_SAMPLES
                ? "ready"
                : "stabilizing"
            );
          } else {
            guidanceReadySamplesRef.current = 0;
            setGuidanceState(evaluation.state);
          }
        } catch {
          if (!cancelled && generation === guidanceGenerationRef.current && !finalCaptureLockRef.current) {
            guidanceReadySamplesRef.current = 0;
            setGuidanceState("unavailable");
          }
        }
      })();

      guidanceInFlightRef.current = currentTask;
      try {
        await currentTask;
      } finally {
        if (guidanceInFlightRef.current === currentTask) {
          guidanceInFlightRef.current = null;
        }
      }
    };

    void sampleGuidance();
    const interval = setInterval(() => {
      void sampleGuidance();
    }, NATIVE_FACE_GUIDANCE_SAMPLE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (guidanceGenerationRef.current === generation) {
        guidanceGenerationRef.current += 1;
      }
      guidanceReadySamplesRef.current = 0;
    };
  }, [capturedPhoto, isCameraReady, isCapturing, isFocused, isFullscreenOpen, permission?.granted]);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    finalCaptureLockRef.current = true;
    guidanceGenerationRef.current += 1;
    setIsCapturing(true);
    setCameraError(null);

    try {
      const pendingGuidance = guidanceInFlightRef.current;
      if (pendingGuidance) {
        await pendingGuidance.catch(() => undefined);
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        exif: false,
        skipProcessing: false
      });
      const uploadReadyPhoto = buildUploadReadyCameraPhoto(photo);

      setCapturedPhoto(uploadReadyPhoto);
      onPhotoChange?.(uploadReadyPhoto);
      setIsCameraReady(false);
    } catch {
      setCameraError(copy.captureFailed);
    } finally {
      finalCaptureLockRef.current = false;
      setIsCapturing(false);
    }
  }, [copy.captureFailed, isCameraReady, isCapturing, onPhotoChange]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    onPhotoChange?.(null);
    setCameraError(null);
    setIsCameraReady(false);
    resetGuidance();
  }, [onPhotoChange, resetGuidance]);

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
          onPress={() => {
            if (canAskAgain) {
              void requestPermission();
            } else {
              void Linking.openSettings();
            }
          }}
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

  const guidanceText = resolveGuidanceCopy(copy, guidanceState);

  return (
    <>
      {!isFullscreenOpen ? (
        <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>{copy.previewLabel}</Text>
          <Text style={[styles.bodyText, { color: palette.textMuted }]}>
            {capturedPhoto ? copy.localOnly : guidanceText}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.openCamera}
            onPress={openCamera}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.accent, opacity: pressed ? 0.82 : 1 }
            ]}
          >
            <Text style={styles.primaryButtonText}>{copy.openCamera}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={closeCamera}
        presentationStyle="fullScreen"
        statusBarTranslucent
        supportedOrientations={["portrait"]}
        visible={isFocused && isFullscreenOpen}
      >
        <View
          style={styles.fullscreenRoot}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            previewRectRef.current = { left: 0, top: 0, width, height };
          }}
        >
          {capturedPhoto ? (
            <Image source={{ uri: capturedPhoto.uri }} style={styles.fullscreenMedia} resizeMode="cover" />
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.fullscreenMedia}
              facing="front"
              mode="picture"
              mirror
              onCameraReady={() => {
                setIsCameraReady(true);
                setCameraError(null);
                resetGuidance();
              }}
              onMountError={() => {
                setIsCameraReady(false);
                setCameraError(copy.captureFailed);
                setGuidanceState("unavailable");
              }}
            />
          )}

          {!capturedPhoto ? (
            <View pointerEvents="box-none" style={styles.guideLayer}>
              <View
                pointerEvents="none"
                testID="native-face-guide-oval"
                style={styles.faceOval}
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  guideRectRef.current = { left: x, top: y, width, height };
                }}
              />
            </View>
          ) : null}

          <SafeAreaView pointerEvents="box-none" style={styles.overlay} edges={["top", "left", "right", "bottom"]}>
            <View style={styles.topRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.closeCamera}
                disabled={isCapturing}
                onPress={closeCamera}
                style={({ pressed }) => [
                  styles.closeButton,
                  isCapturing ? styles.disabledButton : null,
                  pressed ? styles.pressedButton : null
                ]}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
              <View pointerEvents="none" style={styles.topCopy}>
                <Text style={styles.sectionLabel}>{capturedPhoto ? copy.capturedLabel : copy.previewLabel}</Text>
                <Text
                  accessibilityLiveRegion="polite"
                  testID="native-face-guidance-status"
                  style={styles.guidanceText}
                >
                  {capturedPhoto ? copy.localOnly : isCameraReady ? guidanceText : copy.alignFace}
                </Text>
              </View>
              <View style={styles.closeSpacer} />
            </View>

            <View style={styles.bottomControls}>
              <Text style={[styles.cameraStatus, cameraError ? styles.errorStatus : null]}>
                {cameraError ?? (capturedPhoto ? copy.localOnly : isCameraReady ? copy.ready : copy.preparing)}
              </Text>
              {capturedPhoto ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.retake}
                  onPress={retakePhoto}
                  style={({ pressed }) => [styles.captureButton, pressed ? styles.pressedButton : null]}
                >
                  <Text style={styles.captureButtonText}>{copy.retake}</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.capture}
                  accessibilityState={{ disabled: !isCameraReady || isCapturing }}
                  disabled={!isCameraReady || isCapturing}
                  onPress={capturePhoto}
                  style={({ pressed }) => [
                    styles.shutterOuter,
                    !isCameraReady || isCapturing ? styles.disabledButton : null,
                    pressed ? styles.pressedButton : null
                  ]}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  statusText: {
    fontSize: 14,
    lineHeight: 20
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
  fullscreenRoot: {
    flex: 1,
    backgroundColor: "#09070A"
  },
  fullscreenMedia: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%"
  },
  guideLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center"
  },
  faceOval: {
    width: "72%",
    maxWidth: 330,
    aspectRatio: 3 / 4,
    borderWidth: 3,
    borderColor: "rgba(255, 140, 179, 0.96)",
    borderRadius: 999,
    backgroundColor: "transparent"
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 8
  },
  topCopy: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    alignItems: "center",
    justifyContent: "center"
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "400"
  },
  closeSpacer: {
    width: 46,
    height: 46
  },
  sectionLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden"
  },
  guidanceText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden"
  },
  bottomControls: {
    alignItems: "center",
    gap: 14,
    paddingBottom: 8
  },
  cameraStatus: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden"
  },
  errorStatus: {
    color: "#FECACA"
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF"
  },
  captureButton: {
    minWidth: 160,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  captureButtonText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "800"
  },
  disabledButton: {
    opacity: 0.45
  },
  pressedButton: {
    opacity: 0.78
  }
});
