"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import c from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";
import LayoutChildren from "./LayoutChildren";
import Scripts from "./Scripts";

const queryClient = new QueryClient();

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
          jetBrainsMono.className,
          "antialiased text-base flex flex-col items-center justify-center flex-1 p-4 space-y-4 md:p-0 md:space-y-0 md:m-0 md:overflow-hidden"
        )}
      >
        <Scripts />

        <QueryClientProvider client={queryClient}>
          {!isOnline && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 relative text-center">
              <span className="font-medium">No internet connection.</span>
              <span className="block sm:inline">
                {" "}
                Please check your network.
              </span>
            </div>
          )}
          <LayoutChildren>{children}</LayoutChildren>
        </QueryClientProvider>
        <Link
          href="https://feedback.mira.network/"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed px-3 py-1 text-sm text-white bg-blue-500 shadow-lg bottom-4 right-4 hover:bg-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-300"
        >
          Feedback
        </Link>
      </body>
    </html>
  );
};

export default Root;
