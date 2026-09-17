import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtechOS",
  description: "The Operating System for Schools",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
