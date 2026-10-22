import FaceLabRoiLiveClient from "./FaceLabRoiLiveClient";

export const metadata = {
  title: "Face Lab ROI Test | BEJEWELY",
  description: "Face Lab M2 ROI research-only local comparison",
  robots: { index: false, follow: false, nocache: true }
};

export default function FaceLabRoiTestPage() {
  return <FaceLabRoiLiveClient />;
}
