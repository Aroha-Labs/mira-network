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
