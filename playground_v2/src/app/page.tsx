"use client";

import axios from "axios";
import Loading from "src/components/PageLoading";
import LoggedinState from "src/components/dashboard/LoggedinState";
import LoggedoutState from "src/components/dashboard/LoggedoutState";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";

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

  // return (
  //   <div className="flex flex-col items-center justify-center flex-1 p-4 space-y-4">
  //     <div className="max-w-[710px] w-full">
  //       <UserInfo user={userSession?.user}></UserInfo>
  //       <AnalyticsCard userSession={userSession} />
  //       <AnalyticsSection userSession={userSession} />
  //       <div className="bg-white p-4 rounded shadow w-full max-w-md">
  //         <div className="flex justify-between items-center">
  //           <div>
  //             <p className="text-sm text-gray-600">Credits remaining</p>
  //             <div className="font-bold text-lg">{creditsDisplay}</div>
  //           </div>
  //           <div className="flex items-center text-gray-700 rounded-full px-3 py-1 ml-4 border border-gray-300 bg-gray-200 cursor-not-allowed text-sm">
  //             Buy more credits
  //             <svg
  //               xmlns="http://www.w3.org/2000/svg"
  //               className="h-5 w-5 ml-1"
  //               viewBox="0 0 20 20"
  //               fill="currentColor"
  //             >
  //               <path
  //                 fillRule="evenodd"
  //                 d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
  //                 clipRule="evenodd"
  //               />
  //             </svg>
  //           </div>
  //         </div>
  //       </div>
  //       <LinkBox
  //         href="/api-logs"
  //         label="View API Logs"
  //         isDisabled={!userSession?.user}
  //       />
  //       <LinkBox
  //         href="/api-keys"
  //         label="Manage API Keys"
  //         isDisabled={!userSession?.user}
  //       />
  //       <LinkBox
  //         href="/network"
  //         label="Network"
  //         isDisabled={!userSession?.user}
  //       />
  //     </div>
  //   </div>
  // );
}
