import "./globals.css";
import AnonymousAuthBootstrap from "@/components/auth/AnonymousAuthBootstrap";

const brandTitle = "Be jewely";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://k-beauty-two.vercel.app";
const siteDescription = "사진 한 장으로 받는 맞춤 뷰티 · 스타일 리포트";
const socialDescription =
  "사진 한 장과 몇 가지 질문으로, 내 피부에 맞는 제품과 루틴을 정리합니다.";
 
const themeInitScript = `
(() => {
  try {
    const storageKey = "bejewely-theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : systemTheme;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("scheme-dark", theme === "dark");
    root.classList.toggle("scheme-light", theme !== "dark");
    root.dataset.theme = theme;
  } catch {
    document.documentElement.classList.add("scheme-light");
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: brandTitle,
    template: `%s | ${brandTitle}`
  },
  description: siteDescription,
  openGraph: {
    title: brandTitle,
    description: socialDescription,
    url: "/",
    siteName: brandTitle,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: brandTitle
      }
    ],
    locale: "ko_KR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: brandTitle,
    description: socialDescription,
    images: ["/twitter-image.png"]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="scheme-light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="ui-page">
        <AnonymousAuthBootstrap />
        {children}
      </body>
    </html>
  );
}
