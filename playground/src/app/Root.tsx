"use client";

import c from "clsx";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link"; // Import Link from next/link

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
          <header className="sticky top-0 flex items-center justify-center border-b border-gray-300 p-4 gap-2 bg-white z-10">
            <Link href="/" className="flex items-center gap-2">
              <img src="/img/logo.svg" alt="Mira" />
              <h3 className="text-lg">playground</h3>
            </Link>
            {/* Tailwind's text-lg sets the font size to 18px */}
            <Link
              href="/chat"
              className="ml-auto text-blue-500 hover:underline"
            >
              Generate
            </Link>
          </header>
          {!isOnline && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center">
              <span className="font-medium">No internet connection.</span>
              <span className="block sm:inline">
                {" "}
                Please check your network.
              </span>
            </div>
          )}
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
};

export default Root;
