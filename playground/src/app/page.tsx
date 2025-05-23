"use client";

import Link from "next/link";
import LinkBox from "src/components/LinkBox";
import UserInfo from "src/components/UserInfo";
import AnalyticsSection from "src/components/AnalyticsSection";
import Loading from "src/components/PageLoading";
import { useSession } from "src/hooks/useSession";
import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { User } from "src/types/user";
import { USDollar } from "src/utils/currency";

const fetchUserDetails = async () => {
  const response = await api.get<User>("/me");
  return response.data;
};

export default function Home() {
  const { data: userSession, error, isLoading } = useSession();

  const { data: userData, isLoading: isUserLoading } = useQuery({
    queryKey: ["userData"],
    queryFn: fetchUserDetails,
    enabled: !!userSession?.access_token,
  });

  if (isLoading) {
    return <Loading fullPage />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div
          className="relative px-4 py-3 text-red-700 bg-red-100 border border-red-400 rounded-sm"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 space-y-4 bg-gray-100">
      <img src="/img/logo.svg" alt="Mira Network Logo" className="w-auto h-12" />
      <h1 className="text-sm font-bold text-gray-800">Console | Mira Network</h1>
      <p className="max-w-md text-sm text-center text-gray-600">
        A distributed system for managing and interacting with various LLM providers
        through a unified interface
      </p>
      <div className="h-0.5 "></div>
      <UserInfo user={userSession?.user}>
        <AnalyticsSection />
      </UserInfo>

      {/* Getting Started Section - Moved to top for prominence */}
      <div className="w-full max-w-md mt-6">
        <div className="p-4 border border-indigo-200 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-indigo-900">New to Flows?</h3>
              <p className="mt-1 text-xs text-indigo-700">
                Learn how to create and manage AI workflows with our interactive terminal.
              </p>
              <Link
                href="/help/flows"
                className="inline-flex items-center mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View Getting Started Guide
                <svg
                  className="w-3 h-3 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md p-4 bg-white rounded-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Credits remaining</p>
            <div className="text-lg font-bold">
              {isUserLoading ? (
                <div className="w-12 h-6 mt-1 bg-gray-300 rounded-sm animate-pulse"></div>
              ) : userSession?.user ? (
                <Link
                  href="/credit-history"
                  className="text-blue-600 underline decoration-dotted hover:decoration-solid"
                >
                  {USDollar.format(userData?.credits ?? 0)}
                </Link>
              ) : (
                "$---"
              )}
            </div>
          </div>
          <div className="flex items-center px-3 py-1 ml-4 text-sm text-gray-700 bg-gray-200 border border-gray-300 rounded-full cursor-not-allowed">
            Buy more credits
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 ml-1"
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
        </div>
      </div>
      <LinkBox href="/api-logs" label="View API Logs" isDisabled={!userSession?.user} />
      <LinkBox href="/api-keys" label="Manage API Keys" isDisabled={!userSession?.user} />
      <LinkBox href="/terminal" label="AI Flow Builder" isDisabled={!userSession?.user} />
      <Link
        href="/privacy-policy.html"
        target="_blank"
        className="pb-16 mt-4 text-xs text-blue-400 underline decoration-dotted hover:decoration-solid"
      >
        Privacy Policy
      </Link>
    </div>
  );
}
