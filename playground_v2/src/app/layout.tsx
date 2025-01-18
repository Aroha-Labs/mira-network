import "./globals.css";
import { metadata } from "./metadata";
import Root from "./Root";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Root>{children}</Root>;
}

export { metadata };
