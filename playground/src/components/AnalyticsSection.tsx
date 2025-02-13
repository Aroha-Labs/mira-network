import Link from "next/link";
import React from "react";
import { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";

interface AnalyticsSectionProps {
  userSession?: Session | null;
}

const fetchInferenceCalls = async () => {
  const response = await api.get("/total-inference-calls");
  return response.data;
};

const AnalyticsSection: React.FC<AnalyticsSectionProps> = () => {
  const session = useSession();
  const isLoggedIn = !!session.data?.access_token;

  const {
    data: inferenceCalls,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["inferenceCalls"],
    queryFn: fetchInferenceCalls,
    enabled: isLoggedIn,
  });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">Inference calls</p>
          <div className="font-bold text-lg flex items-center">
            {isLoading ? (
              <div className="animate-pulse bg-gray-300 h-6 w-12 rounded-sm"></div>
            ) : error ? (
              <div className="flex items-center text-red-500">
                <span>Error</span>
                <div className="relative group ml-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 cursor-help"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 shadow-lg w-72 whitespace-normal">
                      <div className="flex gap-2">
                        <svg
                          className="h-5 w-5 text-red-500 shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p className="break-words leading-snug">
                          {error instanceof Error ? error.message : "An error occurred"}
                        </p>
                      </div>
                      <div className="absolute w-3 h-3 bg-red-50 border-b border-r border-red-200 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-1.5"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isLoggedIn ? (
              inferenceCalls?.total || "---"
            ) : (
              "----"
            )}
          </div>
        </div>
        {isLoggedIn ? (
          <Link
            href="/analytics"
            className="flex items-center text-gray-700 rounded-full px-3 py-1 ml-4 border border-gray-300 text-sm hover:bg-gray-200 active:bg-gray-300 transition"
          >
            View analytics
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        ) : (
          <div className="flex items-center text-gray-400 rounded-full px-3 py-1 ml-4 border border-gray-300 text-sm cursor-not-allowed">
            View analytics
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsSection;
