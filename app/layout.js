import "./globals.css";
import { headers } from "next/headers";
import AnonymousAuthBootstrap from "@/components/auth/AnonymousAuthBootstrap";
import securityHeaderPolicy from "@/lib/security/security-headers";

const { isValidCspNonce, NONCE_HEADER_NAME } = securityHeaderPolicy;

const brandTitle = "Be jewely";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://k-beauty-two.vercel.app";
const siteDescription = "사진 한 장과 간단한 설문으로 받아보는 맞춤 스킨케어 리포트";
const socialDescription = siteDescription;
 
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

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const requestNonce = requestHeaders.get(NONCE_HEADER_NAME);
  const nonce = isValidCspNonce(requestNonce) ? requestNonce : null;

  return (
    <html lang="ko" className="scheme-light" suppressHydrationWarning>
      <head>
        {nonce ? (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: themeInitScript }}
          />
        ) : null}
      </head>
      <body className="ui-page">
        <AnonymousAuthBootstrap />
        {children}
      </body>
    </html>
  );
}
