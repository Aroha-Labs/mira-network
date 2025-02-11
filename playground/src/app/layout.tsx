import type { Metadata } from "next";
import "./globals.css";
import Root from "./Root";

export const metadata: Metadata = {
  title: "Console | Mira Network",
  description: "Mira Network Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return <Root>{children}</Root>;
}
