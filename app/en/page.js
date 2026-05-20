const brandTitle = "Be jewely";
const englishDescription = "A personalized skincare report from one photo and a quick survey.";

export const metadata = {
  title: {
    absolute: brandTitle
  },
  description: englishDescription,
  openGraph: {
    title: brandTitle,
    description: englishDescription,
    url: "/en",
    siteName: brandTitle,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: brandTitle
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: brandTitle,
    description: englishDescription,
    images: ["/twitter-image.png"]
  }
};

export { default } from "../page";
