"use client";

import c from "clsx";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link"; // Import Link from next/link
import LayoutChildren from "./LayoutChildren";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface RootProps {
  children: React.ReactNode;
}

const Root = ({ children }: RootProps) => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <html lang="en">
      <body
        className={c(
          geistSans.variable,
          geistMono.variable,
          "antialiased text-base flex flex-col bg-gray-100"
        )} // Tailwind's text-base sets the font size to 14px
      >
        <QueryClientProvider client={queryClient}>
          <header className="sticky top-0 z-10 flex items-center justify-center gap-2 p-4 bg-white border-b border-gray-300">
            <Link href="/" className="flex items-center gap-2">
              <img src="/img/logo.svg" alt="Mira" />
              <h3 className="text-lg">console</h3>
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                Beta
              </span>
            </Link>
            {/* Tailwind's text-lg sets the font size to 18px */}
            <div className="flex-1"></div>
            <Link href="/chat" className="flex text-blue-500 hover:underline">
              Console
            </Link>
            <Link
              href="/terminal"
              className="flex text-blue-500 hover:underline"
            >
              Terminal
            </Link>
            <Link
              href="/admin"
              className="flex ml-4 text-blue-500 hover:underline"
            >
              Admin
            </Link>
          </header>
          {!isOnline && (
            <div className="relative px-4 py-3 text-center text-red-700 bg-red-100 border border-red-400 rounded">
              <span className="font-medium">No internet connection.</span>
              <span className="block sm:inline">
                {" "}
                Please check your network.
              </span>
            </div>
          )}
          <LayoutChildren>{children}</LayoutChildren>
          <a
            href="https://console-feedback.arohalabs.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed px-3 py-1 text-sm text-white bg-blue-500 rounded-full shadow-lg bottom-4 right-4 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Feedback
          </a>
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
};

export default Root;
