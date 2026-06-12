import { CheckInPageContent } from "../../../my/check-in/page";
import { getMyCopy } from "@/lib/my/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: getMyCopy("en").metadata.checkInTitle
};

export default async function EnglishCheckInPage() {
  return <CheckInPageContent locale="en" />;
}
