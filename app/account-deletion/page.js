import AccountDeletionPanel from "@/components/account/AccountDeletionPanel";

export const metadata = {
  title: "계정 삭제 | BEJEWELY",
  description: "BEJEWELY 계정과 연결된 소비자 데이터를 삭제하는 공식 계정 삭제 경로입니다."
};

export default function AccountDeletionPage() {
  return <AccountDeletionPanel locale="ko" />;
}
