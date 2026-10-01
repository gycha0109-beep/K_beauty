import { POST as handleFaceReading } from "../face-reading/route";

export async function POST(request) {
  return handleFaceReading(request, {
    guardEndpoint: "face-reading-test",
    issueSimulationAuthority: true
  });
}
