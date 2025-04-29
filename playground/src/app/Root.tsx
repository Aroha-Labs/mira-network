"use client";

import c from "clsx";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Lato, Merriweather } from "next/font/google";
import LayoutChildren from "./LayoutChildren";
import { Toaster } from "react-hot-toast";
import { Header } from "src/components/Header";
import { CaptchaProvider } from "src/contexts/CaptchaContext";
import { CaptchaModal } from "src/components/CaptchaModal";

const queryClient = new QueryClient();

const lato = Lato({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const merriweather = Merriweather({
  variable: "--font-header",
  subsets: ["latin"],
  weight: ["400", "700"],
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
          lato.variable,
          merriweather.variable,
          "antialiased text-base flex flex-col bg-gray-100"
        )} // Tailwind's text-base sets the font size to 14px
      >
        <QueryClientProvider client={queryClient}>
          <CaptchaProvider>
            <Header />
            {!isOnline && (
              <div className="relative px-4 py-3 text-center text-red-700 bg-red-100 border border-red-400 rounded-sm">
                <span className="font-medium">No internet connection.</span>
                <span className="block sm:inline"> Please check your network.</span>
              </div>
            )}
            <LayoutChildren>{children}</LayoutChildren>
            <div className="fixed bottom-4 right-4">
              <div className="relative group">
                <a
                  href="https://feedback.mira.network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1 text-sm text-white bg-blue-500 rounded-full shadow-lg hover:bg-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-300"
                >
                  <span>Feedback</span>
                  <span className="text-[10px] opacity-60">
                    {process.env.NEXT_PUBLIC_VERSION || "0.0.0"}
                  </span>
                </a>
                <div className="absolute right-0 w-64 mb-2 transition-opacity duration-200 opacity-0 pointer-events-none bottom-full group-hover:opacity-100">
                  <div className="relative px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg">
                    <p className="mb-2">
                      Please include this version number when reporting issues or
                      requesting features
                    </p>
                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-sm">
                      <code className="font-mono">
                        {process.env.NEXT_PUBLIC_VERSION || "0.0.0"}
                      </code>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(
                            `v${process.env.NEXT_PUBLIC_VERSION || "0.0.0"}`
                          );
                        }}
                        className="p-1 ml-auto transition-colors rounded-sm pointer-events-auto hover:bg-gray-700"
                        title="Copy to clipboard"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="absolute bottom-0 w-2 h-2 transform rotate-45 translate-y-1/2 bg-gray-900 right-4"></div>
                  </div>
                </div>
              </div>
            </div>
            <Toaster />
            <CaptchaModal />
          </CaptchaProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
};

export default Root;
