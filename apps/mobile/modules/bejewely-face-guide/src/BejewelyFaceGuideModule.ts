import { NativeModule, requireOptionalNativeModule } from "expo";

export type NativeDetectedFace = Readonly<{
  boundingBox: Readonly<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
  headEulerAngleX: number;
  headEulerAngleY: number;
  headEulerAngleZ: number;
}>;

export type NativeFaceDetectionResult = Readonly<{
  faces: readonly NativeDetectedFace[];
}>;

declare class BejewelyFaceGuideNativeModule extends NativeModule {
  detectFacesAsync(uri: string, deleteAfterRead: boolean): Promise<NativeFaceDetectionResult>;
}

const nativeModule = requireOptionalNativeModule<BejewelyFaceGuideNativeModule>("BejewelyFaceGuide");

export const isNativeFaceGuideAvailable = nativeModule !== null;

export async function detectNativeFacesAsync(
  uri: string,
  deleteAfterRead = true
): Promise<NativeFaceDetectionResult | null> {
  if (!nativeModule) {
    return null;
  }

  return nativeModule.detectFacesAsync(uri, deleteAfterRead);
}
