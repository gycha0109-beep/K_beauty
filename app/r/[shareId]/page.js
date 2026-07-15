import SharedResultLoader from "@/components/result/SharedResultLoader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Shared skin analysis result | Be jewely",
  description: "A privately loaded shared skin analysis result.",
  robots: { index: false, follow: false }
};

export default async function SharedResultPage({ params }) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return <SharedResultLoader shareId={resolved?.shareId || ""} />;
}
