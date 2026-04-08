import "./globals.css";

export const metadata = {
  title: "K-Beauty AI Skin Test",
  description: "Upload one face photo and get a simple K-beauty routine."
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
