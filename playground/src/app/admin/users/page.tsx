"use client";

import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";
import UserCard from "src/components/UserCard";
import { useQuery } from "@tanstack/react-query";
import Loading from "src/components/PageLoading";
import { useState, useEffect } from "react";
import { MagnifyingGlassIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { User } from "src/types/user";
import ErrorMessage from "src/components/ErrorMessage";

interface UsersResponse {
  users: User[];
  total: number;
  totalPages: number;
}

const fetchUsers = async (page: number, search: string) => {
  const response = await api.get<UsersResponse>("/admin/users", {
    params: { page, search },
  });
  return response.data;
};

const AdminUsers = () => {
  const { data: userSession } = useSession();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submittedQuery, setSubmittedQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["users", submittedQuery, currentPage],
    queryFn: () => fetchUsers(currentPage, submittedQuery),
    enabled: !!userSession?.access_token,
    retry: 2,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    setSubmittedQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSubmittedQuery("");
    setCurrentPage(1);
  };

  // Add keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.getElementById("user-search");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!userSession?.access_token) {
    return (
      <div className="flex items-center justify-center h-64">
        Please log in to view users.
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              User Management
            </h1>
            <p className="mt-1 sm:mt-2 text-sm text-gray-600">
              Manage users, their roles, credits, and view their usage metrics
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
            title="Refresh users list"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching && (
              <span className="absolute top-1/2 -translate-y-1/2 -left-24 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-sm whitespace-nowrap">
                Refreshing...
              </span>
            )}
          </button>
        </div>

        <form onSubmit={handleSearch} className="mb-6 sm:mb-8">
          <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center bg-white shadow-sm border border-gray-300 rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="pl-4">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="user-search"
                type="text"
                placeholder='Search users... (Press "/" to focus)'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-3 bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500"
              />
              <div className="flex items-center pr-2 space-x-2">
                {(searchQuery || submittedQuery) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
                <div className="h-6 w-px bg-gray-300"></div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isLoading ? <Loading size="sm" className="text-white" /> : "Search"}
                </button>
              </div>
            </div>
          </div>
          {submittedQuery && (
            <div className="mt-3 text-sm text-gray-600 text-center">
              Showing results for: &quot;{submittedQuery}&quot;
            </div>
          )}
        </form>

        {isError ? (
          <div className="max-w-2xl mx-auto">
            <ErrorMessage
              message={error instanceof Error ? error.message : "Failed to load users"}
              retry={() => refetch()}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loading />
              </div>
            ) : data?.users.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <div className="text-gray-500">
                  No users found {submittedQuery && `for "${submittedQuery}"`}
                </div>
              </div>
            ) : (
              <>
                {data?.users.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}

                {/* Pagination Controls */}
                {data && data.totalPages > 1 && (
                  <div className="mt-6 flex justify-center items-center gap-3">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {data.totalPages}
                    </div>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(data.totalPages, p + 1))
                      }
                      disabled={currentPage === data.totalPages}
                      className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
