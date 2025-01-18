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
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 bg-gray-100 p-4 space-y-4">
      <img src="/img/logo.svg" alt="Mira Network Logo" className="h-12 w-auto" />
      <h1 className="text-sm font-bold text-gray-800">Console | Mira Network</h1>
      <p className="text-sm text-gray-600 text-center max-w-md">
        A distributed system for managing and interacting with various LLM providers
        through a unified interface
      </p>
      <div className="h-0.5 "></div>
      <UserInfo user={userSession?.user}>
        <AnalyticsSection />
      </UserInfo>
      <div className="bg-white p-4 rounded shadow w-full max-w-md">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Credits remaining</p>
            <div className="font-bold text-lg">
              {isUserLoading ? (
                <div className="animate-pulse bg-gray-300 h-6 w-12 rounded mt-1"></div>
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
          <div className="flex items-center text-gray-700 rounded-full px-3 py-1 ml-4 border border-gray-300 bg-gray-200 cursor-not-allowed text-sm">
            Buy more credits
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
        </div>
      </div>
      <LinkBox href="/api-logs" label="View API Logs" isDisabled={!userSession?.user} />
      <LinkBox href="/api-keys" label="Manage API Keys" isDisabled={!userSession?.user} />
      <LinkBox href="/network" label="Network" isDisabled={!userSession?.user} />
      <Link
        href="/privacy-policy.html"
        target="_blank"
        className="text-blue-400 underline decoration-dotted hover:decoration-solid mt-4 text-xs pb-16"
      >
        Privacy Policy
      </Link>
    </div>
  );
}
