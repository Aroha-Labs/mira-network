import type { Metadata } from "next";
import "./globals.css";
import Root from "./Root";
import { MiraProvider } from '../components/MiraProvider';

export const metadata: Metadata = {
  title: "Console | Mira Network",
  description: "Mira Network Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return <MiraProvider><Root>{children}</Root></MiraProvider>;
}
