import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mira Console",
  description: "Effortless AI workflows to power your next big idea",
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL ?? ""),
  openGraph: {
    title: "Mira Console",
    description: "Effortless AI workflows to power your next big idea",
    images: [
      {
        url: "/icons/open-graph-image.png",
        width: 512,
        height: 512,
        alt: "Mira Console",
      },
    ],
    url: process.env.NEXT_PUBLIC_URL ?? "",
  },
  icons: {
    icon: "/icons/logo-dark.png",
  },
  manifest: "/manifest.json",
};

// Move themeColor to viewport export
export const viewport = {
  themeColor: "#4F95FF",
};
