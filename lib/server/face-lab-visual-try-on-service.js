import "server-only";

import {
  FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION,
  FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION,
  buildFaceLabVisualTryOnProviderRequest,
  generateFaceLabVisualTryOnCore
} from "@/lib/face-lab-v2/visual-try-on-service-core";
import {
  executeOpenAiImageEdit,
  OPENAI_IMAGE_EDIT_MODEL
} from "@/lib/server/openai-image-edit-runtime";

export {
  FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION,
  FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION,
  buildFaceLabVisualTryOnProviderRequest
};

export async function generateFaceLabVisualTryOn({
  providerRuntime =
    executeOpenAiImageEdit,
  model =
    OPENAI_IMAGE_EDIT_MODEL,
  ...input
} = {}) {
  return generateFaceLabVisualTryOnCore({
    ...input,
    providerRuntime,
    model
  });
}
