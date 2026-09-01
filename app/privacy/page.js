import PrivacyPolicy from "@/components/legal/PrivacyPolicy";

export const metadata = {
  title: "개인정보 처리방침 | BEJEWELY",
  description: "BEJEWELY 개인정보 처리방침"
};

export default function PrivacyPage() {
  return <PrivacyPolicy locale="ko" />;
}
