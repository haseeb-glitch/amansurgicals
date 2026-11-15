import type { Metadata } from "next";
import "./globals.css";
import "./workspace-design.css";

export const metadata: Metadata = {
  title: "Aman Surgical | Sales Workspace",
  description: "Aman Surgical sales register and invoicing.",
  icons: { icon: "/aman-surgical-mark.png", apple: "/aman-surgical-mark.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
