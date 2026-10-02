import { notFound } from "next/navigation";
import FaceLabPilotReviewBoard from "@/components/face-lab-test/FaceLabPilotReviewBoard";

export const dynamic = "force-dynamic";

export default function FaceLabPilotReviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <FaceLabPilotReviewBoard />
  );
}
