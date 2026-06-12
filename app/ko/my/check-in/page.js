import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function KoreanCheckInPageAlias() {
  redirect("/my/check-in");
}
