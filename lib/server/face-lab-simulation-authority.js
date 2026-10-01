import "server-only";

export {
  FACE_LAB_SIMULATION_AUTHORITY_TTL_MS,
  FACE_LAB_SIMULATION_AUTHORITY_VERSION,
  hashFaceLabAuthorityImage,
  hashFaceLabAuthorityValue,
  issueFaceLabSimulationAuthority,
  stableSerializeFaceLabAuthority,
  verifyFaceLabSimulationAuthority
} from "@/lib/face-lab-v2/simulation-authority-core";
