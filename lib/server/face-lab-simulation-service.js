import "server-only";

import {
  FACE_LAB_AI_SIMULATION_VERSION,
  FACE_LAB_SIMULATION_FIDELITY_VERSION,
  FACE_LAB_SIMULATION_REQUIRED_CHECKS,
  generateFaceLabSimulationCore
} from "@/lib/face-lab-v2/simulation-service-core";
import {
  executeOpenAiImageEdit,
  OPENAI_IMAGE_EDIT_MODEL
} from "@/lib/server/openai-image-edit-runtime";

export {
  FACE_LAB_AI_SIMULATION_VERSION,
  FACE_LAB_SIMULATION_FIDELITY_VERSION,
  FACE_LAB_SIMULATION_REQUIRED_CHECKS
};

export async function generateFaceLabSimulation({
  providerRuntime =
    executeOpenAiImageEdit,
  model =
    OPENAI_IMAGE_EDIT_MODEL,
  ...input
} = {}) {
  return generateFaceLabSimulationCore({
    ...input,
    providerRuntime,
    model
  });
}
