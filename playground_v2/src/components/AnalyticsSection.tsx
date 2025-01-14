import { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import React from "react";
import { API_BASE_URL } from "src/config";

interface AnalyticsSectionProps {
  userSession?: Session | null;
}

const fetchInferenceCalls = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/total-inference-calls`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ userSession }) => {
  const isLoggedIn = !!userSession?.access_token;

  const {
    data: inferenceCalls,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["inferenceCalls"],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchInferenceCalls(userSession.access_token);
    },
    enabled: !!userSession?.access_token,
  });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">Inference calls</p>
          <div className="font-bold text-lg">
            {isLoading ? (
              <div className="animate-pulse bg-gray-300 h-6 w-12"></div>
            ) : error ? (
              "Error"
            ) : isLoggedIn ? (
              inferenceCalls
            ) : (
              "----"
            )}
          </div>
        </div>
        {isLoggedIn ? (
          <Link
            href="/analytics"
            className="flex items-center text-gray-700 px-3 py-1 ml-4 border border-gray-300 text-sm hover:bg-gray-200 active:bg-gray-300 transition"
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
          <div className="flex items-center text-gray-400 px-3 py-1 ml-4 border border-gray-300 text-sm cursor-not-allowed">
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
