"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import { format } from "date-fns";
import Loading from "src/components/PageLoading";
import api from "src/lib/axios";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";

interface CreditHistory {
  id: number;
  user_id: string;
  amount: number;
  description: string;
  created_at: string;
}

const fetchCreditHistory = async (): Promise<CreditHistory[]> => {
  const response = await api.get("/user-credits-history");
  return response.data;
};

const CreditHistoryPage = () => {
  const { data: userSession } = useSession();
  const { data, error, isLoading } = useQuery({
    queryKey: ["creditHistory"],
    queryFn: fetchCreditHistory,
    enabled: !!userSession?.access_token,
  });

  if (isLoading) {
    return <Loading fullPage />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading credit history</div>
      </div>
    );
  }

  // Calculate total credits and usage
  const totalCredits =
    data?.reduce((sum, entry) => sum + (entry.amount > 0 ? entry.amount : 0), 0) || 0;
  const totalUsage =
    data?.reduce(
      (sum, entry) => sum + (entry.amount < 0 ? Math.abs(entry.amount) : 0),
      0
    ) || 0;

  return (
    <div className="space-y-6 container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Credit History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your credit usage and transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ArrowDownIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Credits Added</p>
              <p className="text-xl font-semibold text-gray-900">
                {totalCredits.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <ArrowUpIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Usage</p>
              <p className="text-xl font-semibold text-gray-900">
                {totalUsage.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline View */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Transaction Timeline
          </h3>
        </div>
        <div className="p-6">
          <div className="flow-root">
            <ul role="list" className="-mb-8">
              {data?.map((entry, idx) => (
                <li key={entry.id}>
                  <div className="relative pb-8">
                    {idx !== data.length - 1 && (
                      <span
                        className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative flex items-start space-x-3">
                      <div className="relative">
                        <div
                          className={`
                          h-10 w-10 rounded-full flex items-center justify-center
                          ${
                            entry.amount > 0
                              ? "bg-blue-50 text-blue-600"
                              : "bg-red-50 text-red-600"
                          }
                        `}
                        >
                          {entry.amount > 0 ? (
                            <ArrowDownIcon className="h-5 w-5" />
                          ) : (
                            <ArrowUpIcon className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              entry.amount > 0 ? "text-blue-600" : "text-red-600"
                            }`}
                          >
                            {entry.amount > 0 ? "+" : ""}
                            {entry.amount.toFixed(4)}
                          </span>
                          <span className="text-gray-500">•</span>
                          <time dateTime={entry.created_at} className="text-gray-500">
                            {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                          </time>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-600">
                          {entry.description}
                        </p>
                      </div>
                      <div className="shrink-0 self-center">
                        <div
                          className={`
                          px-2 py-1 text-xs font-medium rounded-full
                          ${
                            entry.amount > 0
                              ? "bg-blue-50 text-blue-700"
                              : "bg-red-50 text-red-700"
                          }
                        `}
                        >
                          {entry.amount > 0 ? "Credit" : "Usage"}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditHistoryPage;
