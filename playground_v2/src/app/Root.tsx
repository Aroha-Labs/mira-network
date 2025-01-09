"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import c from "clsx";
import { useEffect, useState } from "react";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";
import LayoutChildren from "./LayoutChildren";

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
          "antialiased text-base flex flex-col"
        )}
      >
        <QueryClientProvider client={queryClient}>
          {/* <header className="sticky top-0 flex items-center justify-center border-b border-gray-300 p-4 gap-2 bg-white z-10"> */}
          {/* <Link href="/" className="flex items-center gap-2">
              <img src="/img/logo.svg" alt="Mira" />
              <h3 className={c(gtSuper.className, "text-lg")}>playground</h3>
            </Link> */}
          {/* Tailwind's text-lg sets the font size to 18px */}
          {/* <div className="flex-1"></div>
            <Link href="/chat" className="flex text-blue-500 hover:underline">
              Generate
            </Link>
            <Link
              href="/admin"
              className="flex text-blue-500 hover:underline ml-4"
            >
              Admin
            </Link> */}
          {/* </header> */}
          {!isOnline && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center">
              <span className="font-medium">No internet connection.</span>
              <span className="block sm:inline">
                {" "}
                Please check your network.
              </span>
            </div>
          )}
          <LayoutChildren>{children}</LayoutChildren>
        </QueryClientProvider>
      </body>
    </html>
  );
};

export default Root;
