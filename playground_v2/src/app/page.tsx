"use client";

import Loading from "src/components/PageLoading";
import LoggedinState from "src/components/dashboard/LoggedinState";
import LoggedoutState from "src/components/dashboard/LoggedoutState";
import { useSession } from "src/hooks/useSession";

export default function Home() {
  const { data: userSession, error, isLoading } = useSession();

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

  if (!userSession?.user) {
    return <LoggedoutState />;
  }

  return <LoggedinState userSession={userSession} />;
}
