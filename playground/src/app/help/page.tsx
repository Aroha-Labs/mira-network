"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HelpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/help/flows");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto border-b-2 border-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Redirecting to help...</p>
      </div>
    </div>
  );
}
