import type { Metadata } from "next";
import "./globals.css";
import Root from "./Root";

export const metadata: Metadata = {
  title: "Playground | Mira Network",
  description: "A playground for Mira Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Root>{children}</Root>;
}
