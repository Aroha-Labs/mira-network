"use client";

import c from "clsx";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Lato, Merriweather } from "next/font/google";
import LayoutChildren from "./LayoutChildren";
import { Toaster } from "react-hot-toast";
import { Header } from "src/components/Header";

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
          <Header />

          {!isOnline && (
            <div className="relative px-4 py-3 text-center text-red-700 bg-red-100 border border-red-400 rounded">
              <span className="font-medium">No internet connection.</span>
              <span className="block sm:inline"> Please check your network.</span>
            </div>
          )}
          <LayoutChildren>{children}</LayoutChildren>
          <div className="fixed bottom-4 right-4">
            <div className="group relative">
              <a
                href="https://feedback.mira.network"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-sm text-white bg-blue-500 rounded-full shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 flex items-center gap-2"
              >
                <span>Feedback</span>
                <span className="text-[10px] opacity-60">
                  {process.env.NEXT_PUBLIC_VERSION || "0.0.0"}
                </span>
              </a>
              <div className="absolute bottom-full right-0 mb-2 w-64 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg relative">
                  <p className="mb-2">
                    Please include this version number when reporting issues or requesting
                    features
                  </p>
                  <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
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
                      className="ml-auto p-1 hover:bg-gray-700 rounded transition-colors pointer-events-auto"
                      title="Copy to clipboard"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
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
                  <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
};

export default Root;
