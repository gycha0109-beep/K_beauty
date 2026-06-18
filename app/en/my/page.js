import { MyPageContent } from "../../my/page";
import { getMyCopy } from "@/lib/my/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: getMyCopy("en").metadata.title
};

export default async function EnglishMyPage() {
  return <MyPageContent locale="en" />;
}
