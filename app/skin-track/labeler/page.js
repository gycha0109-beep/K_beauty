import SkinImageLabeler from "./SkinImageLabeler";
export const metadata = {
  title: "Skin Track 사진 판별기 | Be jewely",
  description: "브라우저에서 피부 사진의 관찰 특징을 분류하고 결과를 내려받는 로컬 전용 도구.",
  robots: { index: false, follow: false, nocache: true }
};
export default function SkinTrackLabelerPage() {
  return <SkinImageLabeler />;
}
