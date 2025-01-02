"use client";

import Link from "next/link";
import LinkBox from "src/components/LinkBox";
import UserInfo from "src/components/UserInfo";
import AnalyticsSection from "src/components/AnalyticsSection";
import { User } from "@supabase/supabase-js";
import Loading from "src/components/Loading";
import { useSession } from "src/hooks/useSession";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "src/config";

const fetchUserCredits = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/user-credits`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export default function Home() {
  const { data: userSession, error, isLoading } = useSession();
  const user = userSession?.user;

  const { data: userCredits, isLoading: isCreditsLoading } = useQuery({
    queryKey: ["userCredits"],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchUserCredits(userSession.access_token);
    },
    enabled: !!userSession?.access_token,
  });

  if (isLoading) {
    return <Loading />;
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
      <UserInfo user={user as User | null}>
        <AnalyticsSection userSession={userSession} />
      </UserInfo>
      <div className="bg-white p-4 rounded shadow w-full max-w-md">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Credits remaining</p>
            <div className="font-bold text-lg">
              {isCreditsLoading ? (
                <div className="animate-pulse bg-gray-300 h-6 w-12 rounded mt-1"></div>
              ) : user ? (
                <Link href="/credit-history">
                  {`$${userCredits?.credits.toFixed(2)}`}
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
      <LinkBox href="/api-logs" label="View API Logs" isDisabled={!user} />
      <LinkBox href="/api-keys" label="Manage API Keys" isDisabled={!user} />
      <LinkBox href="/network" label="Network" isDisabled={!user} />
    </div>
  );
}
