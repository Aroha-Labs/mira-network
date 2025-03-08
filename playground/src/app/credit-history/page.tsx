"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import { format } from "date-fns";
import Loading from "src/components/PageLoading";
import api from "src/lib/axios";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

interface CreditHistory {
  id: number;
  user_id: string;
  amount: number;
  description: string;
  created_at: string;
}

interface PaginatedResponse {
  items: CreditHistory[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

const fetchCreditHistory = async (
  page: number = 1,
  size: number = 20
): Promise<PaginatedResponse> => {
  const response = await api.get(`/user-credits-history?page=${page}&size=${size}`);
  return response.data;
};

const CreditHistoryPage = () => {
  const { data: userSession } = useSession();
  const [page, setPage] = useState(1);
  const {
    data: history,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["creditHistory", page],
    queryFn: () => fetchCreditHistory(page),
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

  return (
    <div className="space-y-6 container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Credit History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your credit usage and transactions
        </p>
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
              {history?.items.map((entry, idx) => (
                <li key={entry.id}>
                  <div className="relative pb-8">
                    {idx !== history.items.length - 1 && (
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

        {/* Pagination Controls */}
        {history && history.pages > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setPage((page) => Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((page) => Math.min(history.pages, page + 1))}
                disabled={page === history.pages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">{(page - 1) * history.size + 1}</span> to{" "}
                  <span className="font-medium">
                    {Math.min(page * history.size, history.total)}
                  </span>{" "}
                  of <span className="font-medium">{history.total}</span> results
                </p>
              </div>
              <div>
                <nav
                  className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                  aria-label="Pagination"
                >
                  {Array.from({ length: history.pages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          pageNum === page
                            ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0"
                        } ${pageNum === 1 ? "rounded-l-md" : ""} ${
                          pageNum === history.pages ? "rounded-r-md" : ""
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  )}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditHistoryPage;
