import "./globals.css";
import AnonymousAuthBootstrap from "@/components/auth/AnonymousAuthBootstrap";

const siteTitle = "1분이면 완성되는 맞춤 스킨케어 리포트";
const siteDescription = "사진 한 장과 몇 가지 질문으로, 내 피부에 맞는 제품과 루틴을 정리합니다.";

export const metadata = {
  metadataBase: new URL("https://beauty-two.vercel.app"),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "Bejewely",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: siteTitle
      }
    ],
    locale: "ko_KR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/twitter-image.png"]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="scheme-light dark:scheme-dark">
      <body className="ui-page">
        <AnonymousAuthBootstrap />
        {children}
      </body>
    </html>
  );
}
