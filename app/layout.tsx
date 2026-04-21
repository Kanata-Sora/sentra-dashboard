import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SENTRA Dashboard",
  description: "SENTRAプロジェクトの進捗・成果を可視化するダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
